// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This code runs in Supabase Edge Functions (Deno runtime)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sisu-signature, x-sisu-secret',
};

const MILESTONE_KEYS = [
  'earnest_money',
  'inspection_ordered',
  'inspection_notice_sent',
  'inspection_10day',
  'sale_contingency',
  'financing_contingency',
  'appraisal_ordered',
  'appraisal_received',
  'appraisal_satisfied',
  'title',
  'walk_through',
  'ctc',
  'closing',
] as const;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const sisuWebhookSecret = Deno.env.get('SISU_WEBHOOK_SECRET') || '';
  const sisuApiKey = Deno.env.get('SISU_API_KEY') || '';
  const sisuApiBaseUrl = Deno.env.get('SISU_API_BASE_URL') || 'https://beta.sisu.co/api/v1';

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let rawBodyText = '';
  let payload: any = {};
  let logId: string | null = null;

  try {
    // 1. Verify Secret / Signature
    const sisuSignature = req.headers.get('x-sisu-signature') || req.headers.get('x-sisu-secret') || '';
    const authHeader = req.headers.get('authorization') || '';

    const isAuthorized =
      !sisuWebhookSecret || // If secret not set in dev, allow
      sisuSignature === sisuWebhookSecret ||
      authHeader === `Bearer ${sisuWebhookSecret}`;

    rawBodyText = await req.text();
    payload = JSON.parse(rawBodyText || '{}');

    // Extract transaction ID and event
    const eventType = payload.event || payload.event_type || 'transaction.updated';
    const sisuTxId = payload.transaction_id || payload.data?.id || payload.id || null;

    // Collect headers for debugging log
    const headersObj: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headersObj[key] = value;
    });

    // 2. Log raw payload to sisu_webhook_log
    const { data: logEntry, error: logErr } = await supabase
      .from('sisu_webhook_log')
      .insert({
        payload,
        headers: headersObj,
        event_type: eventType,
        transaction_id: sisuTxId,
        received_at: new Date().toISOString(),
        processed: false,
      })
      .select('id')
      .single();

    if (logEntry) logId = logEntry.id;
    if (logErr) console.warn('Could not insert sisu_webhook_log:', logErr);

    if (!isAuthorized) {
      if (logId) {
        await supabase
          .from('sisu_webhook_log')
          .update({ error: 'Unauthorized: invalid webhook signature or secret' })
          .eq('id', logId);
      }
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Handle delta vs full payload
    // If data is missing full property details, fetch full object from Sisu GET endpoint
    let sisuData = payload.data || payload;
    if ((!sisuData.property_address && !sisuData.address) && sisuTxId && sisuApiKey) {
      try {
        const getRes = await fetch(`${sisuApiBaseUrl}/transactions/${sisuTxId}`, {
          headers: {
            Authorization: `Bearer ${sisuApiKey}`,
            'Content-Type': 'application/json',
          },
        });
        if (getRes.ok) {
          sisuData = await getRes.json();
        } else {
          console.warn(`Sisu GET ${sisuTxId} returned ${getRes.status}`);
        }
      } catch (fetchErr) {
        console.warn('Error fetching full transaction from Sisu:', fetchErr);
      }
    }

    if (!sisuTxId && !sisuData.id) {
      throw new Error('No transaction_id found in Sisu webhook payload');
    }

    const finalSisuId = String(sisuTxId || sisuData.id);

    // 4. Resolve Agent & TC relationships
    let listingAgentId: string | null = null;
    let sellingAgentId: string | null = null;
    let assignedTcId: string | null = null;

    const primaryAgentEmail = sisuData.agents?.primary_agent_email || sisuData.agent_email;
    const primaryAgentSisuId = sisuData.agents?.primary_agent_id || sisuData.agent_id;

    if (primaryAgentEmail || primaryAgentSisuId) {
      let query = supabase.from('agents').select('id, email, sisu_agent_id');
      if (primaryAgentEmail) {
        query = query.eq('email', primaryAgentEmail);
      } else if (primaryAgentSisuId) {
        query = query.eq('sisu_agent_id', primaryAgentSisuId);
      }
      const { data: matchedAgent } = await query.limit(1).maybeSingle();
      if (matchedAgent) {
        const sideStr = (sisuData.side || sisuData.transaction_side || '').toLowerCase();
        if (sideStr === 'seller' || sideStr === 'listing') {
          listingAgentId = matchedAgent.id;
        } else {
          sellingAgentId = matchedAgent.id;
        }
      }
    }

    const tcEmail = sisuData.assigned_tc?.email || sisuData.tc_email;
    if (tcEmail) {
      const { data: matchedTc } = await supabase
        .from('ops_users')
        .select('id')
        .eq('email', tcEmail)
        .limit(1)
        .maybeSingle();
      if (matchedTc) {
        assignedTcId = matchedTc.id;
      }
    }

    // 5. Upsert Transactions record
    const address = sisuData.property_address || sisuData.address || 'Unknown Address';
    const city = sisuData.city || 'Chicago';
    const side = (sisuData.side || sisuData.transaction_side || 'buyer').toLowerCase();
    const status = (sisuData.status || sisuData.stage || 'pending').toLowerCase();
    const clientName =
      sisuData.client?.full_name ||
      sisuData.client?.name ||
      sisuData.client_name ||
      'Unnamed Client';
    const clientPhone = sisuData.client?.phone || sisuData.client_phone || null;
    const otherPartyName = sisuData.other_party?.name || sisuData.other_party_name || null;
    const otherPartyAgent =
      sisuData.other_party?.agent ||
      sisuData.other_party?.agent_name ||
      sisuData.other_party_agent ||
      null;
    const contractDate = sisuData.contract_date || null;

    // Check if transaction already exists
    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id, sisu_transaction_id, updated_at')
      .eq('sisu_transaction_id', finalSisuId)
      .maybeSingle();

    let transactionId = existingTx?.id;

    if (existingTx) {
      const { error: updateErr } = await supabase
        .from('transactions')
        .update({
          status,
          property_address: address,
          city,
          side,
          client_name: clientName,
          client_phone: clientPhone,
          other_party_name: otherPartyName,
          other_party_agent: otherPartyAgent,
          listing_agent_id: listingAgentId || undefined,
          selling_agent_id: sellingAgentId || undefined,
          assigned_tc_id: assignedTcId || undefined,
          contract_date: contractDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingTx.id);

      if (updateErr) throw updateErr;
    } else {
      const { data: newTx, error: insertErr } = await supabase
        .from('transactions')
        .insert({
          sisu_transaction_id: finalSisuId,
          status,
          property_address: address,
          city,
          side,
          client_name: clientName,
          client_phone: clientPhone,
          other_party_name: otherPartyName,
          other_party_agent: otherPartyAgent,
          listing_agent_id: listingAgentId,
          selling_agent_id: sellingAgentId,
          assigned_tc_id: assignedTcId,
          contract_date: contractDate,
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;
      transactionId = newTx.id;
    }

    // 6. Map Milestones with Conflict Detection
    // IMPORTANT: For any milestone field that currently has source='manual'
    // and was updated more recently than this incoming Sisu update, DO NOT overwrite it.
    // Log a sync_conflicts row instead.
    let conflictsFound = 0;
    const incomingMilestones = sisuData.milestones || {};
    const sisuUpdatedAt = new Date(sisuData.updated_at || payload.timestamp || new Date()).getTime();

    // Fetch existing milestones for this transaction
    const { data: existingMilestones } = await supabase
      .from('milestones')
      .select('*')
      .eq('transaction_id', transactionId);

    const existingMap = new Map<string, any>();
    (existingMilestones || []).forEach((m) => {
      existingMap.set(m.milestone_type, m);
    });

    for (const mKey of MILESTONE_KEYS) {
      const incomingM = incomingMilestones[mKey];
      if (!incomingM) continue;

      const targetDate = incomingM.target_date || null;
      const actualDate = incomingM.actual_date || null;
      const mStatus = incomingM.status || 'pending';
      const mNotes = incomingM.notes || null;

      const existingM = existingMap.get(mKey);

      if (existingM) {
        const isManual = existingM.source === 'manual';
        const manualUpdatedAt = new Date(existingM.updated_at).getTime();

        // Conflict condition: source='manual' and edited after/concurrently with Sisu
        if (isManual && manualUpdatedAt >= sisuUpdatedAt) {
          // Check if values actually differ
          const isDateDiff = existingM.target_date !== targetDate || existingM.actual_date !== actualDate;
          const isStatusDiff = existingM.status !== mStatus;

          if (isDateDiff || isStatusDiff) {
            conflictsFound++;
            // Log conflict to sync_conflicts table
            await supabase.from('sync_conflicts').insert({
              transaction_id: transactionId,
              sisu_transaction_id: finalSisuId,
              milestone_type: mKey,
              current_manual_value: {
                target_date: existingM.target_date,
                actual_date: existingM.actual_date,
                status: existingM.status,
                notes: existingM.notes,
                source: existingM.source,
                updated_at: existingM.updated_at,
              },
              incoming_sisu_value: {
                target_date: targetDate,
                actual_date: actualDate,
                status: mStatus,
                notes: mNotes,
                source: 'sisu',
                sisu_updated_at: sisuData.updated_at,
              },
              detected_at: new Date().toISOString(),
              resolved: false,
              resolution_notes: 'Manual edit preserved; Sisu overwrite prevented.',
            });

            // SKIP overwrite - preserve manual edit
            continue;
          }
        }

        // Safe to overwrite (source is 'sisu' or older manual update)
        await supabase
          .from('milestones')
          .update({
            target_date: targetDate,
            actual_date: actualDate,
            status: mStatus,
            source: 'sisu',
            notes: mNotes || existingM.notes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingM.id);
      } else {
        // No existing milestone record: create new
        await supabase.from('milestones').insert({
          transaction_id: transactionId,
          milestone_type: mKey,
          target_date: targetDate,
          actual_date: actualDate,
          status: mStatus,
          source: 'sisu',
          notes: mNotes,
        });
      }
    }

    // 7. Mark Webhook Log as processed
    if (logId) {
      await supabase
        .from('sisu_webhook_log')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq('id', logId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: transactionId,
        sisu_transaction_id: finalSisuId,
        conflicts_found: conflictsFound,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('Error in sisu-webhook-receiver:', err);
    if (logId) {
      await supabase
        .from('sisu_webhook_log')
        .update({
          error: err.message || String(err),
          processed: false,
        })
        .eq('id', logId);
    }

    return new Response(
      JSON.stringify({
        error: err.message || 'Internal error processing Sisu webhook',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
