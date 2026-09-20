// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This code runs in Supabase Edge Functions (Deno runtime)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sisu-signature, x-sisu-secret, x-amz-sns-message-type',
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

function extractTasksFromPayload(payload: any, sisuData: any, dataObj: any, fullObj: any): any[] | null {
  const candidates = [
    payload?.tasks,
    sisuData?.tasks,
    dataObj?.tasks,
    dataObj?.object_data?.tasks,
    dataObj?.object_data?.checklist_tasks,
    dataObj?.object_data?.checklists,
    fullObj?.tasks,
    fullObj?.checklist_tasks,
    payload?.data?.tasks,
    payload?.checklist_tasks,
    payload?.checklists,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate;
    }
  }

  return null;
}

async function fetchSisuTransactionTasks(
  sisuTxId: string,
  sisuApiBaseUrl: string,
  sisuApiKey: string
): Promise<any[]> {
  if (!sisuApiKey || !sisuTxId) return [];

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
    { 'Authorization': `Bearer ${sisuApiKey}`, 'x-team-id': '1200' },
    { 'x-api-key': sisuApiKey },
  ];

  const endpoints = [
    `${sisuApiBaseUrl}/transactions/${sisuTxId}/tasks`,
    `${sisuApiBaseUrl}/transaction/${sisuTxId}/tasks`,
    `${sisuApiBaseUrl}/tasks?transaction_id=${sisuTxId}`,
    `${sisuApiBaseUrl}/tasks?client_id=${sisuTxId}`,
    `${sisuApiBaseUrl}/client/${sisuTxId}/tasks`,
    `${sisuApiBaseUrl}/client/${sisuTxId}/checklists`,
  ];

  for (const endpoint of endpoints) {
    for (const headersObj of authHeaderVariants) {
      try {
        console.log(`[Sisu Tasks API] Attempting fetch: ${endpoint}`);
        const res = await fetch(endpoint, {
          headers: {
            ...headersObj,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (res.ok) {
          const json = await res.json();
          const tasks = Array.isArray(json)
            ? json
            : json?.data || json?.tasks || json?.checklist_tasks || json?.results || [];
          if (Array.isArray(tasks) && tasks.length > 0) {
            console.log(`[Sisu Tasks API] Successfully fetched ${tasks.length} tasks from ${endpoint}`);
            return tasks;
          }
        }
      } catch (err: any) {
        console.warn(`[Sisu Tasks API] Warning: fetch failed for ${endpoint}:`, err.message || err);
      }
    }
  }

  return [];
}

function parseTaskDetails(task: any) {
  const name =
    task?.name ||
    task?.task_name ||
    task?.title ||
    task?.description ||
    task?.label ||
    (typeof task === 'string' ? task : '');

  const rawStatus = (task?.status || task?.task_status || task?.stage || '').toString().toLowerCase().trim();
  const isComplete =
    rawStatus === 'complete' ||
    rawStatus === 'completed' ||
    rawStatus === 'done' ||
    rawStatus === 'satisfied' ||
    task?.completed === true ||
    task?.is_complete === true ||
    task?.is_completed === true ||
    Boolean(task?.completed_date || task?.completed_at || task?.date_completed);

  let completionDate =
    task?.completed_date ||
    task?.completed_at ||
    task?.date_completed ||
    task?.actual_date ||
    null;

  if (completionDate && typeof completionDate === 'string') {
    completionDate = completionDate.slice(0, 10);
  }

  return { name: String(name).trim(), isComplete, completionDate, rawStatus };
}

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
    rawBodyText = await req.text();
    try {
      payload = JSON.parse(rawBodyText || '{}');
    } catch {
      payload = { raw: rawBodyText };
    }

    // Collect headers for debugging log
    const headersObj: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headersObj[key] = value;
    });

    const snsMessageType = req.headers.get('x-amz-sns-message-type') || '';
    const payloadType = payload.Type || payload.type || '';
    const payloadEvent = payload.event || payload.event_type || '';

    // =========================================================================
    // 1. Detect Sisu / AWS SNS SubscriptionConfirmation Message
    // =========================================================================
    const isSubscriptionConfirmation =
      snsMessageType === 'SubscriptionConfirmation' ||
      payloadType === 'SubscriptionConfirmation' ||
      payloadType === 'subscription_confirmation' ||
      payloadEvent === 'subscription_confirmation' ||
      Boolean(payload.SubscribeURL || payload.subscribe_url || payload.SubscribeUrl || payload.subscribeUrl);

    if (isSubscriptionConfirmation) {
      console.log('[Sisu Webhook] Detected SubscriptionConfirmation message.');

      // Extract SubscribeURL
      let subscribeUrl: string | null =
        payload.SubscribeURL ||
        payload.subscribe_url ||
        payload.SubscribeUrl ||
        payload.subscribeUrl ||
        payload.url ||
        null;

      // Check if nested in Message JSON string
      if (!subscribeUrl && typeof payload.Message === 'string') {
        try {
          const nested = JSON.parse(payload.Message);
          subscribeUrl =
            nested.SubscribeURL ||
            nested.subscribe_url ||
            nested.SubscribeUrl ||
            nested.subscribeUrl ||
            nested.url ||
            null;
        } catch {
          // ignore parsing error
        }
      }

      // Log the initial confirmation payload
      const { data: confLog, error: confLogErr } = await supabase
        .from('sisu_webhook_log')
        .insert({
          payload,
          headers: headersObj,
          event_type: 'SubscriptionConfirmation',
          transaction_id: null,
          received_at: new Date().toISOString(),
          processed: false,
        })
        .select('id')
        .single();

      if (confLog) logId = confLog.id;
      if (confLogErr) console.warn('Could not insert confirmation sisu_webhook_log:', confLogErr);

      let getStatus: number | null = null;
      let getOk = false;
      let getResponseText = '';
      let getError: string | null = null;

      if (subscribeUrl) {
        try {
          console.log(`[Sisu Webhook] Making outbound confirmation GET to: ${subscribeUrl}`);
          const confirmRes = await fetch(subscribeUrl);
          getStatus = confirmRes.status;
          getOk = confirmRes.ok;
          getResponseText = await confirmRes.text();
          console.log(
            `[Sisu Webhook] Confirmation GET response (status ${getStatus}): ${getResponseText.slice(0, 300)}`
          );

          if (!confirmRes.ok) {
            getError = `Confirmation GET failed with HTTP status ${getStatus}: ${getResponseText.slice(0, 300)}`;
          }
        } catch (fetchErr: any) {
          getError = `Confirmation GET network error: ${fetchErr.message || String(fetchErr)}`;
          console.error('[Sisu Webhook] Error executing confirmation GET:', fetchErr);
        }
      } else {
        getError = 'SubscriptionConfirmation detected, but no SubscribeURL field found in payload';
        console.warn(getError, payload);
      }

      // Update log record with confirmation result
      if (logId) {
        await supabase
          .from('sisu_webhook_log')
          .update({
            processed: getOk,
            error: getError,
            processed_at: new Date().toISOString(),
          })
          .eq('id', logId);
      }

      // Return 200 OK to Sisu's original POST either way
      return new Response(
        JSON.stringify({
          success: true,
          type: 'SubscriptionConfirmation',
          message: getOk ? 'Subscription successfully confirmed' : 'Subscription confirmation attempted',
          subscribe_url: subscribeUrl,
          get_status: getStatus,
          get_ok: getOk,
          error: getError,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // =========================================================================
    // 2. Standard Transaction Webhook Ingestion & Signature Verification
    // =========================================================================
    const sisuSignature = req.headers.get('x-sisu-signature') || req.headers.get('x-sisu-secret') || '';
    const authHeader = req.headers.get('authorization') || '';

    const isAuthorized =
      !sisuWebhookSecret || // If secret not set in dev, allow
      sisuSignature === sisuWebhookSecret ||
      authHeader === `Bearer ${sisuWebhookSecret}`;

    // If payload is wrapped in an AWS SNS Notification envelope, unwrap the inner Message JSON
    if ((payloadType === 'Notification' || snsMessageType === 'Notification' || payload.Type === 'Notification') && typeof payload.Message === 'string') {
      try {
        const innerPayload = JSON.parse(payload.Message);
        console.log('[Sisu Webhook] Successfully unwrapped AWS SNS Notification Message.');
        payload = { ...innerPayload, _snsEnvelope: payload };
      } catch (unwrapErr) {
        console.warn('[Sisu Webhook] Could not parse inner SNS Message JSON:', unwrapErr);
      }
    }

    // Extract transaction ID across root, data_objects, or SNS payload wrapper
    const dataObj = Array.isArray(payload.data_objects) && payload.data_objects.length > 0 ? payload.data_objects[0] : null;
    const fullObj = dataObj?.object_data?.full_object || {};
    const updatedVals = dataObj?.updated_values || {};
    const agentRecord = dataObj?.object_data?.agent_record || {};
    const requiredVals = dataObj?.required_values || {};

    const eventType = payload.event || payload.event_type || payload.action || payloadEvent || 'transaction.updated';
    const sisuTxId =
      payload.transaction_id ||
      payload.transactionId ||
      payload.id ||
      payload.sisu_id ||
      payload.sisu_transaction_id ||
      payload.entity_id ||
      updatedVals.client_id ||
      requiredVals.client_id ||
      fullObj.client_id ||
      dataObj?.object_data?.guid ||
      payload.data?.id ||
      payload.data?.transaction_id ||
      payload.data?.transactionId ||
      null;

    // Log raw transaction payload to sisu_webhook_log
    const { data: logEntry, error: logErr } = await supabase
      .from('sisu_webhook_log')
      .insert({
        payload,
        headers: headersObj,
        event_type: eventType,
        transaction_id: sisuTxId ? String(sisuTxId) : null,
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

    // 3. Handle delta vs full payload or nested data_objects
    const sisuData = payload.data || payload;

    if (!sisuTxId) {
      throw new Error('No transaction_id / client_id found in Sisu webhook payload');
    }

    const finalSisuId = String(sisuTxId);

    // 4. Resolve Agent & TC relationships
    let listingAgentId: string | null = null;
    let sellingAgentId: string | null = null;
    let assignedTcId: string | null = null;

    const primaryAgentEmail =
      agentRecord.email ||
      sisuData.agents?.primary_agent_email ||
      payload.agents?.primary_agent_email ||
      sisuData.agent_email ||
      payload.agent_email;

    const primaryAgentSisuId =
      agentRecord.agent_id ||
      sisuData.agents?.primary_agent_id ||
      payload.agents?.primary_agent_id ||
      sisuData.agent_id ||
      payload.agent_id;

    if (primaryAgentEmail || primaryAgentSisuId) {
      let query = supabase.from('agents').select('id, email, sisu_agent_id');
      if (primaryAgentEmail) {
        query = query.eq('email', primaryAgentEmail.toLowerCase());
      } else if (primaryAgentSisuId) {
        query = query.eq('sisu_agent_id', primaryAgentSisuId);
      }
      let { data: matchedAgent } = await query.limit(1).maybeSingle();

      if (!matchedAgent && primaryAgentEmail) {
        const agentName =
          agentRecord.full_name ||
          (agentRecord.first_name ? `${agentRecord.first_name} ${agentRecord.last_name || ''}`.trim() : null) ||
          primaryAgentEmail.split('@')[0];
        const { data: newAgent } = await supabase
          .from('agents')
          .insert({
            name: agentName,
            email: primaryAgentEmail.toLowerCase(),
            phone: agentRecord.mobile_phone || null,
            sisu_agent_id: primaryAgentSisuId ? String(primaryAgentSisuId) : null,
            active: true,
          })
          .select('id, email')
          .maybeSingle();
        matchedAgent = newAgent;
      }

      if (matchedAgent) {
        const sideType = (sisuData.side || sisuData.transaction_side || fullObj.type_id || updatedVals.type_id || '').toLowerCase();
        if (sideType === 's' || sideType === 'seller' || sideType === 'listing') {
          listingAgentId = matchedAgent.id;
        } else {
          sellingAgentId = matchedAgent.id;
        }
      }
    }

    const tcEmail = sisuData.assigned_tc?.email || payload.assigned_tc?.email || sisuData.tc_email || payload.tc_email;
    if (tcEmail) {
      let { data: matchedTc } = await supabase
        .from('ops_users')
        .select('id')
        .eq('email', tcEmail.toLowerCase())
        .limit(1)
        .maybeSingle();

      if (!matchedTc) {
        const tcName = tcEmail.split('@')[0].replace('.', ' ');
        const { data: newTc } = await supabase
          .from('ops_users')
          .insert({
            name: tcName,
            email: tcEmail.toLowerCase(),
            role: 'tc',
          })
          .select('id')
          .maybeSingle();
        matchedTc = newTc;
      }

      if (matchedTc) {
        assignedTcId = matchedTc.id;
      }
    }

    // 5. Upsert Transactions record
    // Extract raw incoming values without default fallback placeholders
    const rawAddress =
      sisuData.property_address ||
      sisuData.address ||
      fullObj.address_1 ||
      updatedVals.address_1 ||
      payload.property_address ||
      payload.address ||
      null;

    let rawCity = sisuData.city || fullObj.city || updatedVals.city || payload.city || null;
    let rawState = sisuData.state || fullObj.state || updatedVals.state || payload.state || null;

    if ((!rawCity || !rawState) && rawAddress && typeof rawAddress === 'string' && rawAddress.includes(' ')) {
      const parts = rawAddress.trim().split(/\s+/);
      if (/^\d{5}$/.test(parts[parts.length - 1])) {
        if (!rawCity && parts.length >= 2) {
          rawCity = parts[parts.length - 2];
        }
      }
    }

    const rawZip =
      sisuData.zip ||
      sisuData.postal_code ||
      fullObj.postal_code ||
      updatedVals.postal_code ||
      payload.zip ||
      null;

    const rawSideType = sisuData.side || sisuData.transaction_side || fullObj.type_id || updatedVals.type_id || payload.side || null;
    const resolvedSide = rawSideType
      ? (['s', 'seller', 'listing'].includes(String(rawSideType).toLowerCase()) ? 'seller' : 'buyer')
      : null;

    const rawStatus =
      sisuData.status ||
      sisuData.stage ||
      fullObj.pipeline_status ||
      updatedVals.pipeline_status ||
      payload.status ||
      null;

    const rawClientName =
      sisuData.client?.name ||
      sisuData.client?.full_name ||
      sisuData.client_name ||
      fullObj.full_name ||
      (fullObj.first_name ? `${fullObj.first_name} ${fullObj.last_name || ''}`.trim() : null) ||
      (updatedVals.first_name ? `${updatedVals.first_name} ${updatedVals.last_name || ''}`.trim() : null) ||
      null;

    const rawClientPhone =
      sisuData.client?.phone ||
      sisuData.client_phone ||
      fullObj.mobile_phone ||
      updatedVals.mobile_phone ||
      null;

    const rawClientEmail =
      sisuData.client?.email ||
      sisuData.client_email ||
      fullObj.email ||
      updatedVals.email ||
      payload.client_email ||
      null;

    const otherPartyName = sisuData.other_party?.name || sisuData.other_party_name || null;
    const otherPartyAgent =
      sisuData.other_party?.agent ||
      sisuData.other_party?.agent_name ||
      sisuData.other_party_agent ||
      null;
    const contractDate = sisuData.contract_date || null;

    const rawPrice =
      sisuData.price ||
      sisuData.trans_amt ||
      fullObj.trans_amt ||
      fullObj.orig_trans_amt ||
      updatedVals.trans_amt ||
      null;

    // Check if transaction already exists
    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id, sisu_transaction_id, updated_at, property_address, client_name, status, side, city, state')
      .eq('sisu_transaction_id', finalSisuId)
      .maybeSingle();

    let transactionId = existingTx?.id;

    if (existingTx) {
      // Build guarded partial update object - NEVER wipe out existing valid data with placeholders
      const txUpdates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Only update address if a genuine non-placeholder address was provided
      if (rawAddress && typeof rawAddress === 'string' && rawAddress.trim() !== '') {
        const trimmedAddr = rawAddress.trim();
        if (trimmedAddr.toLowerCase() !== 'pending address' && trimmedAddr.toLowerCase() !== 'unknown address') {
          txUpdates.property_address = trimmedAddr;
        }
      }

      // Only update client_name if a genuine non-placeholder name was provided
      if (rawClientName && typeof rawClientName === 'string' && rawClientName.trim() !== '') {
        const trimmedName = rawClientName.trim();
        if (trimmedName.toLowerCase() !== 'unnamed client') {
          txUpdates.client_name = trimmedName;
        }
      }

      // Only update status if explicitly provided in this payload
      if (rawStatus && typeof rawStatus === 'string' && rawStatus.trim() !== '') {
        txUpdates.status = rawStatus.trim();
      }

      // Only update side if explicitly resolved
      if (resolvedSide) {
        txUpdates.side = resolvedSide;
      }

      // Only update city/state/zip if provided
      if (rawCity && typeof rawCity === 'string' && rawCity.trim() !== '') {
        const trimmedCity = rawCity.trim();
        txUpdates.city = trimmedCity === 'Chicago' ? 'Waynesville' : trimmedCity;
      }
      if (rawState && typeof rawState === 'string' && rawState.trim() !== '') {
        const trimmedState = rawState.trim();
        txUpdates.state = trimmedState === 'IL' ? 'MO' : trimmedState;
      }
      if (rawZip && typeof rawZip === 'string' && rawZip.trim() !== '') {
        txUpdates.zip = rawZip.trim();
      }

      // Only update contact/party/date fields if provided
      if (rawClientPhone && typeof rawClientPhone === 'string' && rawClientPhone.trim() !== '') {
        txUpdates.client_phone = rawClientPhone.trim();
      }
      if (rawClientEmail && typeof rawClientEmail === 'string' && rawClientEmail.trim() !== '') {
        txUpdates.client_email = rawClientEmail.trim();
      }
      if (otherPartyName && typeof otherPartyName === 'string' && otherPartyName.trim() !== '') {
        txUpdates.other_party_name = otherPartyName.trim();
      }
      if (otherPartyAgent && typeof otherPartyAgent === 'string' && otherPartyAgent.trim() !== '') {
        txUpdates.other_party_agent = otherPartyAgent.trim();
      }
      if (contractDate && typeof contractDate === 'string' && contractDate.trim() !== '') {
        txUpdates.contract_date = contractDate.trim();
      }
      if (rawPrice !== null && rawPrice !== undefined && !isNaN(Number(rawPrice))) {
        txUpdates.price = Number(rawPrice);
      }

      // Only update agent & TC assignments if matched in this event
      if (listingAgentId) txUpdates.listing_agent_id = listingAgentId;
      if (sellingAgentId) txUpdates.selling_agent_id = sellingAgentId;
      if (assignedTcId) txUpdates.assigned_tc_id = assignedTcId;

      const { error: updateErr } = await supabase
        .from('transactions')
        .update(txUpdates)
        .eq('id', existingTx.id);

      if (updateErr) throw updateErr;
    } else {
      // For brand new transactions, ensure required non-null columns have sane fallbacks
      const insertAddress = (rawAddress && typeof rawAddress === 'string' && rawAddress.trim()) || 'Pending Address';
      const insertClientName = (rawClientName && typeof rawClientName === 'string' && rawClientName.trim()) || 'Unnamed Client';
      const insertStatus = (rawStatus && typeof rawStatus === 'string' && rawStatus.trim()) || 'pending';
      let insertCity = (rawCity && typeof rawCity === 'string' && rawCity.trim()) || 'Waynesville';
      if (insertCity === 'Chicago') insertCity = 'Waynesville';
      let insertState = (rawState && typeof rawState === 'string' && rawState.trim()) || 'MO';
      if (insertState === 'IL') insertState = 'MO';
      const insertSide = resolvedSide || 'buyer';

      const { data: newTx, error: insertErr } = await supabase
        .from('transactions')
        .insert({
          sisu_transaction_id: finalSisuId,
          status: insertStatus,
          property_address: insertAddress,
          city: insertCity,
          state: insertState,
          zip: (rawZip && typeof rawZip === 'string' && rawZip.trim()) || null,
          side: insertSide,
          client_name: insertClientName,
          client_phone: (rawClientPhone && typeof rawClientPhone === 'string' && rawClientPhone.trim()) || null,
          client_email: (rawClientEmail && typeof rawClientEmail === 'string' && rawClientEmail.trim()) || null,
          other_party_name: (otherPartyName && typeof otherPartyName === 'string' && otherPartyName.trim()) || null,
          other_party_agent: (otherPartyAgent && typeof otherPartyAgent === 'string' && otherPartyAgent.trim()) || null,
          listing_agent_id: listingAgentId,
          selling_agent_id: sellingAgentId,
          assigned_tc_id: assignedTcId,
          contract_date: (contractDate && typeof contractDate === 'string' && contractDate.trim()) || null,
          price: (rawPrice !== null && rawPrice !== undefined && !isNaN(Number(rawPrice))) ? Number(rawPrice) : null,
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

    // =========================================================================
    // 7. Sisu Checklist Task-Level Synchronization
    // =========================================================================
    let tasksMatched = 0;
    let tasksUnmatched = 0;

    let payloadTasks = extractTasksFromPayload(payload, sisuData, dataObj, fullObj);

    // If payload does NOT include a tasks array, attempt follow-up API call
    if (!payloadTasks || payloadTasks.length === 0) {
      console.log(`[Sisu Webhook] No tasks array found in payload. Attempting auxiliary API fetch for transaction ${finalSisuId}...`);
      try {
        payloadTasks = await fetchSisuTransactionTasks(finalSisuId, sisuApiBaseUrl, sisuApiKey);
      } catch (apiErr: any) {
        console.warn(`[Sisu Webhook] Error attempting auxiliary tasks fetch:`, apiErr.message || apiErr);
        payloadTasks = [];
      }
    } else {
      console.log(`[Sisu Webhook] Found ${payloadTasks.length} tasks in incoming payload.`);
    }

    if (Array.isArray(payloadTasks) && payloadTasks.length > 0) {
      // Fetch active task mappings
      const { data: activeMappings, error: mapErr } = await supabase
        .from('sisu_task_mappings')
        .select('*')
        .eq('active', true);

      if (mapErr) {
        console.warn('[Sisu Webhook] Error querying sisu_task_mappings:', mapErr);
      }

      // Build mapping lookup by lowercase & exact name
      const mappingMap = new Map<string, any>();
      (activeMappings || []).forEach((m: any) => {
        if (m.sisu_task_name) {
          mappingMap.set(m.sisu_task_name.trim(), m);
          mappingMap.set(m.sisu_task_name.trim().toLowerCase(), m);
        }
      });

      // Refetch existing milestones for current transaction to ensure latest state
      const { data: currentMilestones } = await supabase
        .from('milestones')
        .select('*')
        .eq('transaction_id', transactionId);

      const latestMilestoneMap = new Map<string, any>();
      (currentMilestones || []).forEach((m: any) => latestMilestoneMap.set(m.milestone_type, m));

      const receiptDate = new Date().toISOString().split('T')[0];

      for (const task of payloadTasks) {
        const { name: taskName, isComplete, completionDate } = parseTaskDetails(task);
        if (!taskName) continue;

        // Exact match lookup (or lowercase fallback)
        const matchedMapping = mappingMap.get(taskName) || mappingMap.get(taskName.toLowerCase());

        if (matchedMapping) {
          tasksMatched++;
          const targetField = matchedMapping.milestone_field;

          if (isComplete) {
            const actualDate = completionDate || receiptDate;
            const existingM = latestMilestoneMap.get(targetField);

            if (existingM) {
              const isManual = existingM.source === 'manual';
              const manualUpdatedAt = new Date(existingM.updated_at).getTime();

              // Respect manual edits that occurred after or concurrently with incoming update
              if (isManual && manualUpdatedAt >= sisuUpdatedAt) {
                if (existingM.actual_date !== actualDate || (existingM.status !== 'complete' && existingM.status !== 'satisfied')) {
                  conflictsFound++;
                  await supabase.from('sync_conflicts').insert({
                    transaction_id: transactionId,
                    sisu_transaction_id: finalSisuId,
                    milestone_type: targetField,
                    current_manual_value: {
                      target_date: existingM.target_date,
                      actual_date: existingM.actual_date,
                      status: existingM.status,
                      notes: existingM.notes,
                      source: existingM.source,
                      updated_at: existingM.updated_at,
                    },
                    incoming_sisu_value: {
                      task_name: taskName,
                      actual_date: actualDate,
                      status: 'complete',
                      source: 'sisu',
                      sisu_updated_at: sisuData.updated_at || new Date().toISOString(),
                    },
                    detected_at: new Date().toISOString(),
                    resolved: false,
                    resolution_notes: `Manual edit preserved; Sisu task '${taskName}' overwrite prevented.`,
                  });
                  continue;
                }
              }

              // Update milestone
              await supabase
                .from(matchedMapping.milestone_table || 'milestones')
                .update({
                  actual_date: actualDate,
                  status: 'complete',
                  source: 'sisu',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingM.id);

              latestMilestoneMap.set(targetField, {
                ...existingM,
                actual_date: actualDate,
                status: 'complete',
                source: 'sisu',
              });
            } else {
              // Insert new milestone
              const { data: newM } = await supabase
                .from(matchedMapping.milestone_table || 'milestones')
                .insert({
                  transaction_id: transactionId,
                  milestone_type: targetField,
                  actual_date: actualDate,
                  status: 'complete',
                  source: 'sisu',
                })
                .select()
                .maybeSingle();

              if (newM) latestMilestoneMap.set(targetField, newM);
            }
          }
        } else {
          // Task name not found in sisu_task_mappings: log to sisu_unmatched_tasks
          tasksUnmatched++;
          try {
            await supabase.from('sisu_unmatched_tasks').insert({
              task_name: taskName,
              transaction_id: finalSisuId,
              detected_at: new Date().toISOString(),
              task_payload: task,
            });
          } catch (unmatchedErr: any) {
            console.warn('[Sisu Webhook] Could not insert sisu_unmatched_tasks:', unmatchedErr.message || unmatchedErr);
          }
        }
      }
    }

    // =========================================================================
    // 7b. Sisu Custom Transaction Fields Synchronization (Yes/No Form Fields)
    // =========================================================================
    const customFields: Record<string, any> = {
      ...(fullObj?.custom || {}),
      ...(updatedVals?.custom || {}),
      ...(sisuData?.custom || {}),
      ...(payload?.custom || {}),
    };

    const customEntries = Object.entries(customFields);
    if (customEntries.length > 0) {
      console.log(`[Sisu Webhook] Found ${customEntries.length} custom fields in transaction payload:`, Object.keys(customFields));

      const { data: activeMappings } = await supabase
        .from('sisu_task_mappings')
        .select('*')
        .eq('active', true);

      const mappingMap = new Map<string, any>();
      (activeMappings || []).forEach((m: any) => {
        if (m.sisu_task_name) {
          mappingMap.set(m.sisu_task_name.trim(), m);
          mappingMap.set(m.sisu_task_name.trim().toLowerCase(), m);
          mappingMap.set(m.sisu_task_name.trim().toLowerCase().replace(/[\s\-_?]/g, ''), m);
        }
      });

      const { data: currentMilestones } = await supabase
        .from('milestones')
        .select('*')
        .eq('transaction_id', transactionId);

      const latestMilestoneMap = new Map<string, any>();
      (currentMilestones || []).forEach((m: any) => latestMilestoneMap.set(m.milestone_type, m));

      const receiptDate = new Date().toISOString().split('T')[0];

      for (const [key, rawValue] of customEntries) {
        if (rawValue === null || rawValue === undefined) continue;
        const strVal = String(rawValue).trim().toLowerCase();

        // Completion boolean check
        const isYes =
          strVal === 'yes' ||
          strVal === 'true' ||
          strVal === 'y' ||
          strVal === '1' ||
          strVal === 'completed' ||
          strVal === 'satisfied' ||
          strVal === 'done' ||
          rawValue === true ||
          rawValue === 1;

        const isNo =
          strVal === 'no' ||
          strVal === 'false' ||
          strVal === 'n' ||
          strVal === '0' ||
          rawValue === false ||
          rawValue === 0;

        const normalizedKey = key.trim().toLowerCase().replace(/[\s\-_?]/g, '');
        const cleanKey = key.replace(/_/g, ' ').trim().toLowerCase();

        // 1. Direct mapping check from sisu_task_mappings
        const matched =
          mappingMap.get(key) ||
          mappingMap.get(key.toLowerCase()) ||
          mappingMap.get(cleanKey) ||
          mappingMap.get(normalizedKey);

        const targetFields: string[] = [];
        if (matched) {
          targetFields.push(matched.milestone_field);
        } else {
          // 2. Intelligent keyword fallback
          if (normalizedKey.includes('earnest') || normalizedKey.includes('emd')) {
            targetFields.push('earnest_money');
          } else if (normalizedKey.includes('inspection')) {
            if (
              normalizedKey.includes('complet') ||
              normalizedKey.includes('10day') ||
              normalizedKey.includes('resolut') ||
              normalizedKey.includes('satisf')
            ) {
              targetFields.push('inspection_10day', 'inspection_ordered');
            } else {
              targetFields.push('inspection_ordered');
            }
          } else if (normalizedKey.includes('appraisal')) {
            if (
              normalizedKey.includes('satisf') ||
              normalizedKey.includes('receiv') ||
              normalizedKey.includes('complet')
            ) {
              targetFields.push('appraisal_satisfied', 'appraisal_received');
            } else {
              targetFields.push('appraisal_ordered');
            }
          } else if (normalizedKey.includes('financ') || normalizedKey.includes('loan')) {
            targetFields.push('financing_contingency');
          } else if (normalizedKey.includes('title')) {
            targetFields.push('title');
          } else if (normalizedKey.includes('ctc') || normalizedKey.includes('cleartoclose')) {
            targetFields.push('ctc');
          } else if (normalizedKey.includes('walk') || normalizedKey.includes('walkthrough')) {
            targetFields.push('walk_through');
          } else if (
            normalizedKey.includes('closing') ||
            normalizedKey.includes('closed') ||
            normalizedKey.includes('settlement')
          ) {
            targetFields.push('closing');
          }
        }

        if (targetFields.length > 0) {
          for (const targetField of targetFields) {
            const existingM = latestMilestoneMap.get(targetField);
            if (isYes) {
              tasksMatched++;
              if (existingM) {
                const isManual = existingM.source === 'manual';
                const manualUpdatedAt = new Date(existingM.updated_at).getTime();

                if (isManual && manualUpdatedAt >= sisuUpdatedAt) {
                  if (
                    existingM.actual_date !== receiptDate ||
                    (existingM.status !== 'complete' && existingM.status !== 'satisfied')
                  ) {
                    conflictsFound++;
                    continue;
                  }
                }

                await supabase
                  .from('milestones')
                  .update({
                    actual_date: receiptDate,
                    status: 'complete',
                    source: 'sisu',
                    notes: existingM.notes || `Completed via Sisu form: ${key}`,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', existingM.id);

                latestMilestoneMap.set(targetField, {
                  ...existingM,
                  actual_date: receiptDate,
                  status: 'complete',
                  source: 'sisu',
                });
              } else {
                const { data: newM } = await supabase
                  .from('milestones')
                  .insert({
                    transaction_id: transactionId,
                    milestone_type: targetField,
                    actual_date: receiptDate,
                    status: 'complete',
                    source: 'sisu',
                    notes: `Completed via Sisu form: ${key}`,
                  })
                  .select()
                  .maybeSingle();

                if (newM) latestMilestoneMap.set(targetField, newM);
              }
            } else if (
              isNo &&
              existingM &&
              existingM.source === 'sisu' &&
              (existingM.status === 'complete' || existingM.status === 'satisfied')
            ) {
              await supabase
                .from('milestones')
                .update({
                  status: 'pending',
                  actual_date: null,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingM.id);

              latestMilestoneMap.set(targetField, {
                ...existingM,
                status: 'pending',
                actual_date: null,
              });
            }
          }
        }
      }
    }

    // 8. Mark Webhook Log as processed
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
        tasks_matched: tasksMatched,
        tasks_unmatched: tasksUnmatched,
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
