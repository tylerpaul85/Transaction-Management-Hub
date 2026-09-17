// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This code runs in Supabase Edge Functions (Deno runtime)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const sisuApiKey = Deno.env.get('SISU_API_KEY') || '';
  const sisuApiBaseUrl = Deno.env.get('SISU_API_BASE_URL') || 'https://api.sisu.co/api/v1';

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Check if request is sending CSV data directly
  let rawBody = '';
  try {
    rawBody = await req.text();
  } catch {
    rawBody = '';
  }

  if (rawBody && (rawBody.trim().startsWith('ID,') || rawBody.includes('Address Line 1') || rawBody.includes('Transaction Amount'))) {
    console.log('[Reconciliation] Direct CSV payload received. Ingesting transactions...');
    const lines = rawBody.split(/\r?\n/).filter((l) => l.trim());
    const resultRows: any[] = [];

    if (lines.length > 1) {
      const headerLine = lines[0];
      const header: string[] = [];
      let inQuote = false;
      let cur = '';
      for (let c = 0; c < headerLine.length; c++) {
        const ch = headerLine[c];
        if (ch === '"') inQuote = !inQuote;
        else if (ch === ',' && !inQuote) {
          header.push(cur.trim().replace(/^"|"$/g, ''));
          cur = '';
        } else {
          cur += ch;
        }
      }
      header.push(cur.trim().replace(/^"|"$/g, ''));

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('Below are') || line.startsWith('Total')) break;

        const row: string[] = [];
        inQuote = false;
        cur = '';
        for (let c = 0; c < line.length; c++) {
          const ch = line[c];
          if (ch === '"') inQuote = !inQuote;
          else if (ch === ',' && !inQuote) {
            row.push(cur.trim().replace(/^"|"$/g, ''));
            cur = '';
          } else {
            cur += ch;
          }
        }
        row.push(cur.trim().replace(/^"|"$/g, ''));

        if (row.length >= 5 && row[0]) {
          const obj: any = {};
          header.forEach((h, idx) => {
            obj[h] = row[idx] || '';
          });
          resultRows.push(obj);
        }
      }
    }

    const toUpsert = resultRows.map((r, idx) => {
      const sisuId = String(r['ID'] || `BATCH-${Date.now()}-${idx}`).trim();
      const addr = r['Address Line 1'] || r['address'] || 'TBD Address';
      const city = r['City'] || 'Waynesville';
      const state = 'MO';
      const zip = r['Postal Code'] || '';
      const side = String(r['Transaction Type'] || r['type'] || 'buyer').toLowerCase().includes('sell') ? 'seller' : 'buyer';
      
      let status = 'under_contract';
      const rawStat = String(r['Status'] || r['status'] || '').toLowerCase();
      if (rawStat.includes('list') || rawStat.includes('active')) {
        status = 'active';
      }

      const firstName = r['First Name'] || '';
      const lastName = r['Last Name'] || '';
      const clientName = `${firstName} ${lastName}`.trim() || r['client_name'] || 'Client';
      const clientEmail = r['Contact Email'] || null;
      const clientPhone = r['Mobile Phone Number'] || null;

      const priceNum = parseFloat(String(r['Transaction Amount'] || '0').replace(/[^0-9.]/g, '')) || null;
      const contractDate = String(r['Under Contract Date'] || '').slice(0, 10) || new Date().toISOString().split('T')[0];
      const closingDate = String(r['Forecasted Closed Date'] || r['Closed (Settlement) Date'] || '').slice(0, 10) || null;

      return {
        sisu_transaction_id: sisuId.startsWith('SISU-') ? sisuId : `SISU-${sisuId}`,
        property_address: addr,
        city,
        state,
        side,
        status,
        client_name: clientName,
        client_phone: clientPhone,
        contract_date: contractDate,
        other_party_agent: r['Cooperating Agent Name'] || null,
      };
    });

    if (toUpsert.length > 0) {
      const { data: inserted, error: insErr } = await supabase
        .from('transactions')
        .upsert(toUpsert, { onConflict: 'sisu_transaction_id' })
        .select();

      if (insErr) {
        return new Response(JSON.stringify({ error: insErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Successfully ingested ${inserted?.length || toUpsert.length} deals from CSV!`,
          count: inserted?.length || toUpsert.length,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  }

  try {
    let sisuTransactions: any[] = [];
    const apiAttemptLogs: any[] = [];

    if (sisuApiKey) {
      let rawToken = sisuApiKey;
      let decodedStr = '';
      try {
        decodedStr = atob(sisuApiKey);
      } catch {
        decodedStr = '';
      }

      const tokenParts = decodedStr ? decodedStr.split(':') : [];
      const extractedToken = tokenParts.length > 1 ? tokenParts[1] : sisuApiKey;

      const authHeaderVariants = [
        { 'x-api-key': sisuApiKey, 'Authorization': `Bearer ${sisuApiKey}` },
        { 'x-api-key': extractedToken, 'Authorization': `Bearer ${extractedToken}` },
        { 'x-api-key': sisuApiKey, 'x-team-id': '1200' },
        { 'Authorization': `Bearer ${sisuApiKey}`, 'x-team-id': '1200' },
        { 'Authorization': `Bearer ${extractedToken}` },
        { 'api-key': sisuApiKey },
      ];

      const endpointsToTry = [
        `https://beta.sisu.co/api/v2/client`,
        `https://api.sisu.co/api/v2/client`,
        `https://my.sisu.co/api/v1/client`,
        `https://services.sisu.co/api/v1/client`,
        `${sisuApiBaseUrl}/client?team_id=1200`,
        `${sisuApiBaseUrl}/clients?team_id=1200`,
        `${sisuApiBaseUrl}/team/1200/client`,
        `${sisuApiBaseUrl}/team/1200/clients`,
        `${sisuApiBaseUrl}/team/1200/transaction`,
        `${sisuApiBaseUrl}/team/1200/transactions`,
        `${sisuApiBaseUrl}/transaction?team_id=1200`,
        `${sisuApiBaseUrl}/transactions?team_id=1200`,
        `${sisuApiBaseUrl}/client`,
        `${sisuApiBaseUrl}/clients`,
        `${sisuApiBaseUrl}/client/list`,
        `${sisuApiBaseUrl}/client/list?team_id=1200`,
        `https://api.sisu.co/api/v1/client?team_id=1200`,
        `https://api.sisu.co/api/v1/client`,
      ];

      let lastError = '';
      for (const endpoint of endpointsToTry) {
        for (const headersObj of authHeaderVariants) {
          try {
            console.log(`[Reconciliation] Requesting Sisu API: ${endpoint}`);
            const response = await fetch(endpoint, {
              headers: {
                ...headersObj,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
            });

            const status = response.status;
            let responseText = '';
            try {
              responseText = await response.text();
            } catch {
              responseText = '';
            }

            let json: any = null;
            try {
              json = JSON.parse(responseText);
            } catch {
              json = null;
            }

            apiAttemptLogs.push({
              endpoint,
              status,
              headers: Object.keys(headersObj).join(','),
              snippet: responseText.slice(0, 150),
            });

            if (response.ok && json) {
              const fetchedList = Array.isArray(json)
                ? json
                : json.data || json.transactions || json.clients || json.results || [];

              if (Array.isArray(fetchedList) && fetchedList.length > 0) {
                sisuTransactions = fetchedList;
                console.log(`[Reconciliation] Successfully pulled ${sisuTransactions.length} deals from ${endpoint}`);
                break;
              }
            } else {
              lastError = `Status ${status} from ${endpoint}: ${responseText.slice(0, 150)}`;
            }
          } catch (err: any) {
            lastError = err.message || String(err);
            apiAttemptLogs.push({ endpoint, error: lastError });
          }
        }
        if (sisuTransactions.length > 0) break;
      }

      if (sisuTransactions.length === 0 && lastError) {
        console.warn(`[Reconciliation] Sisu API endpoints returned no deals (${lastError}). Diagnostic logs recorded.`);
      }
    }

    // 2. Also re-process any unprocessed webhooks from sisu_webhook_log
    const { data: unprocessedLogs } = await supabase
      .from('sisu_webhook_log')
      .select('*')
      .order('received_at', { ascending: true });

    if (unprocessedLogs && unprocessedLogs.length > 0) {
      for (const log of unprocessedLogs) {
        let payload = log.payload;
        if ((payload.Type === 'Notification' || payload.type === 'Notification') && typeof payload.Message === 'string') {
          try {
            payload = JSON.parse(payload.Message);
          } catch {
            // ignore
          }
        }
        const dataObj = Array.isArray(payload.data_objects) && payload.data_objects.length > 0 ? payload.data_objects[0] : null;
        const fullObj = dataObj?.object_data?.full_object || payload.data || payload;
        const updatedVals = dataObj?.updated_values || {};
        const sisuTxId = String(
          payload.transaction_id ||
          payload.id ||
          updatedVals.client_id ||
          fullObj.client_id ||
          dataObj?.object_data?.guid ||
          ''
        );
        if (sisuTxId && !sisuTransactions.some((t) => String(t.id || t.client_id || t.transaction_id) === sisuTxId)) {
          sisuTransactions.push({
            id: sisuTxId,
            property_address: fullObj.address_1 || updatedVals.address_1 || fullObj.property_address || payload.property_address,
            city: fullObj.city || updatedVals.city || payload.city || 'Waynesville',
            side: (fullObj.type_id || updatedVals.type_id || payload.side || 's') === 's' ? 'seller' : 'buyer',
            status: fullObj.pipeline_status || updatedVals.pipeline_status || payload.status || 'Pre-Listing',
            client: { full_name: fullObj.full_name || updatedVals.first_name ? `${updatedVals.first_name} ${updatedVals.last_name || ''}`.trim() : payload.client_name },
            agent_email: dataObj?.object_data?.agent_record?.email || payload.agent_email,
            milestones: fullObj.milestones || {},
          });
        }
      }
    }

    transactionsChecked = sisuTransactions.length;

    // 2. Iterate through each Sisu transaction and reconcile
    for (const sisuData of sisuTransactions) {
      const sisuTxId = String(sisuData.id || sisuData.transaction_id);
      if (!sisuTxId) continue;

      const address = sisuData.property_address || sisuData.address || sisuData.address_1 || 'Unknown Address';
      let state = sisuData.state || 'MO';
      let city = sisuData.city || 'Waynesville';
      if (city === 'Chicago') city = 'Waynesville';
      if (state === 'IL') state = 'MO';

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
      const sisuUpdatedAt = new Date(sisuData.updated_at || new Date()).getTime();

      // Find in DB
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id, sisu_transaction_id, updated_at')
        .eq('sisu_transaction_id', sisuTxId)
        .maybeSingle();

      let transactionId = existingTx?.id;

      if (existingTx) {
        await supabase
          .from('transactions')
          .update({
            status,
            property_address: address,
            city,
            state,
            side,
            client_name: clientName,
            client_phone: clientPhone,
            other_party_name: otherPartyName,
            other_party_agent: otherPartyAgent,
            contract_date: contractDate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingTx.id);

        transactionsUpdated++;
      } else {
        const { data: newTx } = await supabase
          .from('transactions')
          .insert({
            sisu_transaction_id: sisuTxId,
            status,
            property_address: address,
            city,
            state,
            side,
            client_name: clientName,
            client_phone: clientPhone,
            other_party_name: otherPartyName,
            other_party_agent: otherPartyAgent,
            contract_date: contractDate,
          })
          .select('id')
          .single();

        if (newTx) {
          transactionId = newTx.id;
          transactionsUpdated++;
        }
      }

      if (!transactionId) continue;

      // Reconcile milestones
      const incomingMilestones = sisuData.milestones || {};
      const { data: existingMilestones } = await supabase
        .from('milestones')
        .select('*')
        .eq('transaction_id', transactionId);

      const existingMap = new Map<string, any>();
      (existingMilestones || []).forEach((m) => existingMap.set(m.milestone_type, m));

      let txConflicts = 0;

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

          if (isManual && manualUpdatedAt >= sisuUpdatedAt) {
            const isDateDiff =
              existingM.target_date !== targetDate || existingM.actual_date !== actualDate;
            const isStatusDiff = existingM.status !== mStatus;

            if (isDateDiff || isStatusDiff) {
              conflictsFound++;
              txConflicts++;

              await supabase.from('sync_conflicts').insert({
                transaction_id: transactionId,
                sisu_transaction_id: sisuTxId,
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
                resolution_notes: 'Reconciliation: manual edit preserved.',
              });

              continue;
            }
          }

          // Safe to overwrite
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

      runDetails.push({
        sisu_transaction_id: sisuTxId,
        address,
        conflicts: txConflicts,
      });
    }

    const durationMs = Date.now() - startTime;

    // 3. Log summary to reconciliation_runs
    const { data: runSummary } = await supabase
      .from('reconciliation_runs')
      .insert({
        run_at: new Date().toISOString(),
        transactions_checked: transactionsChecked,
        transactions_updated: transactionsUpdated,
        conflicts_found: conflictsFound,
        duration_ms: durationMs,
        status: 'completed',
        details: { items: runDetails, api_attempts: apiAttemptLogs },
      })
      .select('id')
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        run_id: runSummary?.id,
        transactions_checked: transactionsChecked,
        transactions_updated: transactionsUpdated,
        conflicts_found: conflictsFound,
        duration_ms: durationMs,
        api_attempts: apiAttemptLogs,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('Error in sisu-nightly-reconciliation:', err);
    const durationMs = Date.now() - startTime;

    await supabase.from('reconciliation_runs').insert({
      run_at: new Date().toISOString(),
      transactions_checked: transactionsChecked,
      transactions_updated: transactionsUpdated,
      conflicts_found: conflictsFound,
      duration_ms: durationMs,
      status: 'failed',
      details: { error: err.message || String(err) },
    });

    return new Response(
      JSON.stringify({
        error: err.message || 'Internal error in reconciliation run',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
