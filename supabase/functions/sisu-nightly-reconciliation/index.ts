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
  'insurance_binder',
  'title',
  'walk_through',
  'ctc',
  'closing',
] as const;

function isGenuineAddress(address: string | null | undefined): boolean {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  if (trimmed.length < 3) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower === 'pending address' ||
    lower.startsWith('pending address') ||
    lower === 'pending' ||
    lower === 'tbd' ||
    lower === 'tbd address' ||
    lower.startsWith('tbd -') ||
    lower.startsWith('tbd ') ||
    lower === 'n/a' ||
    lower === 'none'
  ) {
    return false;
  }
  return true;
}

function parseSisuDate(val: any): string | null {
  if (!val || typeof val !== 'string' || !val.trim()) return null;
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {}
  return null;
}

function extractTasksFromSisuData(sisuData: any): any[] | null {
  const candidates = [
    sisuData?.tasks,
    sisuData?.checklist_tasks,
    sisuData?.checklists,
    sisuData?.data?.tasks,
    sisuData?.object_data?.tasks,
    sisuData?.object_data?.checklist_tasks,
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
            console.log(`[Reconciliation Tasks API] Successfully fetched ${tasks.length} tasks for tx ${sisuTxId}`);
            return tasks;
          }
        }
      } catch (err: any) {
        console.warn(`[Reconciliation Tasks API] Warning: fetch failed for ${endpoint}:`, err.message || err);
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
            property_address: fullObj.address_1 || updatedVals.address_1 || fullObj.property_address || payload.property_address || null,
            city: fullObj.city || updatedVals.city || payload.city || null,
            state: fullObj.state || updatedVals.state || payload.state || null,
            side: (fullObj.type_id || updatedVals.type_id || payload.side)
              ? (['s', 'seller', 'listing'].includes(String(fullObj.type_id || updatedVals.type_id || payload.side).toLowerCase()) ? 'seller' : 'buyer')
              : null,
            status: fullObj.pipeline_status || updatedVals.pipeline_status || payload.status || null,
            client: {
              full_name: fullObj.full_name || (updatedVals.first_name ? `${updatedVals.first_name} ${updatedVals.last_name || ''}`.trim() : null) || payload.client_name || null,
            },
            agent_email: dataObj?.object_data?.agent_record?.email || payload.agent_email || null,
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

      const rawAddress = sisuData.property_address || sisuData.address || sisuData.address_1 || null;
      let rawState = sisuData.state || null;
      let rawCity = sisuData.city || null;
      if (rawCity === 'Chicago') rawCity = 'Waynesville';
      if (rawState === 'IL') rawState = 'MO';

      const rawSide = sisuData.side || sisuData.transaction_side || null;
      const side = rawSide
        ? (['s', 'seller', 'listing'].includes(String(rawSide).toLowerCase()) ? 'seller' : 'buyer')
        : null;

      const rawStatus = sisuData.status || sisuData.stage || null;
      const status = rawStatus ? String(rawStatus).toLowerCase() : null;

      const rawClientName =
        sisuData.client?.full_name ||
        sisuData.client?.name ||
        sisuData.client_name ||
        null;

      const clientPhone = sisuData.client?.phone || sisuData.client_phone || null;
      const fullObj = sisuData.object_data?.full_object || {};

      const clientPhone = sisuData.client?.phone || sisuData.client_phone || fullObj.mobile_phone || null;
      const otherPartyName = sisuData.other_party?.name || sisuData.other_party_name || null;
      const otherPartyAgent =
        fullObj.coop_agent_name ||
        sisuData.other_party?.agent ||
        sisuData.other_party?.agent_name ||
        sisuData.other_party_agent ||
        null;
      const otherPartyPhone = fullObj.coop_agent_phone || sisuData.other_party_phone || null;
      const otherPartyEmail = fullObj.coop_agent_email || sisuData.other_party_email || null;

      const lenderName = fullObj.mortgage_officer_name || sisuData.mortgage_officer_name || null;
      const lenderEmail = fullObj.mortgage_officer_email || sisuData.mortgage_officer_email || null;
      const lenderPhone = fullObj.mortgage_officer_phone || sisuData.mortgage_officer_phone || null;
      const loanType = fullObj.loan_type || sisuData.loan_type || null;

      const titleCompany = fullObj.custom?.escrow_agent || fullObj.escrow_company_name || fullObj.title_company_name || null;

      const contractDate =
        parseSisuDate(fullObj.uc_dt || sisuData.uc_dt) ||
        sisuData.contract_date ||
        null;

      const emdTargetDate = parseSisuDate(fullObj.earnest_money_due_dt || sisuData.earnest_money_due_dt);
      const inspectionTargetDate = parseSisuDate(fullObj.home_inspection_deadline_dt || sisuData.home_inspection_deadline_dt);
      const loanAppraisalTargetDate = parseSisuDate(fullObj.financing_appraisal_deadline_dt || sisuData.financing_appraisal_deadline_dt);
      const closingTargetDate = parseSisuDate(fullObj.forecasted_closed_dt || sisuData.forecasted_closed_dt);
      const closedActualDate = parseSisuDate(fullObj.closed_dt || sisuData.closed_dt);
      const titleTargetDate = parseSisuDate(fullObj.custom?.title_deadline || sisuData.custom?.title_deadline);

      const sisuUpdatedAt = new Date(sisuData.updated_at || new Date()).getTime();

      // Find in DB
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id, sisu_transaction_id, updated_at, property_address, client_name, status, side, city, state, custom_fields')
        .eq('sisu_transaction_id', sisuTxId)
        .maybeSingle();

      let transactionId = existingTx?.id;

      if (existingTx) {
        // Build guarded partial update object - NEVER overwrite valid data with placeholders
        const txUpdates: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };

        if (rawAddress && typeof rawAddress === 'string' && rawAddress.trim() !== '') {
          const trimmedAddr = rawAddress.trim();
          if (trimmedAddr.toLowerCase() !== 'unknown address' && trimmedAddr.toLowerCase() !== 'pending address') {
            txUpdates.property_address = trimmedAddr;
          }
        }

        if (rawClientName && typeof rawClientName === 'string' && rawClientName.trim() !== '') {
          const trimmedName = rawClientName.trim();
          if (trimmedName.toLowerCase() !== 'unnamed client') {
            txUpdates.client_name = trimmedName;
          }
        }

        if (status && status.trim() !== '') {
          txUpdates.status = status.trim();
        }

        if (side) {
          txUpdates.side = side;
        }

        if (rawCity && typeof rawCity === 'string' && rawCity.trim() !== '') {
          txUpdates.city = rawCity.trim();
        }
        if (rawState && typeof rawState === 'string' && rawState.trim() !== '') {
          txUpdates.state = rawState.trim();
        }
        if (clientPhone && typeof clientPhone === 'string' && clientPhone.trim() !== '') {
          txUpdates.client_phone = clientPhone.trim();
        }
        if (otherPartyName && typeof otherPartyName === 'string' && otherPartyName.trim() !== '') {
          txUpdates.other_party_name = otherPartyName.trim();
        }
        if (otherPartyAgent && typeof otherPartyAgent === 'string' && otherPartyAgent.trim() !== '') {
          txUpdates.other_party_agent = otherPartyAgent.trim();
        }
        if (otherPartyPhone && typeof otherPartyPhone === 'string' && otherPartyPhone.trim() !== '') {
          txUpdates.other_party_phone = otherPartyPhone.trim();
        }
        if (otherPartyEmail && typeof otherPartyEmail === 'string' && otherPartyEmail.trim() !== '') {
          txUpdates.other_party_email = otherPartyEmail.trim();
        }
        if (lenderName && typeof lenderName === 'string' && lenderName.trim() !== '') {
          txUpdates.lender_name = lenderName.trim();
        }
        if (lenderEmail && typeof lenderEmail === 'string' && lenderEmail.trim() !== '') {
          txUpdates.lender_email = lenderEmail.trim();
        }
        if (lenderPhone && typeof lenderPhone === 'string' && lenderPhone.trim() !== '') {
          txUpdates.lender_phone = lenderPhone.trim();
        }
        if (loanType && typeof loanType === 'string' && loanType.trim() !== '') {
          txUpdates.loan_type = loanType.trim();
        }
        if (titleCompany && typeof titleCompany === 'string' && titleCompany.trim() !== '') {
          txUpdates.title_company = titleCompany.trim();
        }
        if (closingTargetDate) {
          txUpdates.target_closing_date = closingTargetDate;
        }
        if (contractDate && typeof contractDate === 'string' && contractDate.trim() !== '') {
          txUpdates.contract_date = contractDate.trim();
        }

        await supabase
          .from('transactions')
          .update(txUpdates)
          .eq('id', existingTx.id);

        transactionsUpdated++;
      } else {
        // Only pull over properties that have a genuine street address
        if (!isGenuineAddress(rawAddress)) {
          console.log(`[Reconciliation] Skipping deal ${sisuTxId} because it has no genuine street address: "${rawAddress}"`);
          continue;
        }

        const insertAddress = rawAddress.trim();
        const insertClientName = (rawClientName && typeof rawClientName === 'string' && rawClientName.trim()) || 'Unnamed Client';
        const insertStatus = status || 'pending';
        const insertCity = (rawCity && typeof rawCity === 'string' && rawCity.trim()) || 'Waynesville';
        const insertState = (rawState && typeof rawState === 'string' && rawState.trim()) || 'MO';
        const insertSide = side || 'buyer';

        const { data: newTx } = await supabase
          .from('transactions')
          .insert({
            sisu_transaction_id: sisuTxId,
            status: insertStatus,
            property_address: insertAddress,
            city: insertCity,
            state: insertState,
            side: insertSide,
            client_name: insertClientName,
            client_phone: clientPhone || null,
            other_party_name: otherPartyName || null,
            other_party_agent: otherPartyAgent || null,
            other_party_phone: otherPartyPhone || null,
            other_party_email: otherPartyEmail || null,
            lender_name: lenderName || null,
            lender_email: lenderEmail || null,
            lender_phone: lenderPhone || null,
            loan_type: loanType || null,
            title_company: titleCompany || null,
            target_closing_date: closingTargetDate || null,
            contract_date: contractDate || null,
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
      const isClosedStage = Boolean(
        (status && ['closed', 'c'].includes(status.toLowerCase().trim())) ||
        (fullObj.pipeline_status && fullObj.pipeline_status.toLowerCase().trim() === 'closed')
      );

      const sisuDates: Record<string, { target_date?: string | null; actual_date?: string | null; status?: string }> = {
        earnest_money: {
          target_date: emdTargetDate,
        },
        inspection_10day: {
          target_date: inspectionTargetDate,
        },
        inspection_ordered: {
          target_date: inspectionTargetDate,
        },
        financing_contingency: {
          target_date: loanAppraisalTargetDate,
        },
        appraisal_satisfied: {
          target_date: loanAppraisalTargetDate,
        },
        appraisal_ordered: {
          target_date: loanAppraisalTargetDate,
        },
        appraisal_received: {
          target_date: loanAppraisalTargetDate,
        },
        title: {
          target_date: titleTargetDate,
        },
        closing: {
          target_date: closingTargetDate,
          actual_date: closedActualDate || (isClosedStage ? new Date().toISOString().split('T')[0] : null),
          status: (closedActualDate || isClosedStage) ? 'complete' : undefined,
        },
      };

      const incomingMilestones = {
        ...sisuDates,
        ...(sisuData.milestones || {}),
      };

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
        const mStatus = incomingM.status;
        const mNotes = (incomingM as any).notes || null;

        if (!targetDate && !actualDate && !mStatus && !mNotes) continue;

        const existingM = existingMap.get(mKey);

        if (existingM) {
          const isManual = existingM.source === 'manual';
          const manualUpdatedAt = new Date(existingM.updated_at).getTime();

          if (isManual && manualUpdatedAt >= sisuUpdatedAt) {
            const isDateDiff = (targetDate && existingM.target_date !== targetDate) || (actualDate && existingM.actual_date !== actualDate);
            const isStatusDiff = Boolean(mStatus && existingM.status !== mStatus);

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
                  status: mStatus || existingM.status,
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

          // Safe to update (source is 'sisu' or older manual update)
          const updateMilestoneData: Record<string, any> = {
            source: 'sisu',
            updated_at: new Date().toISOString(),
          };
          if (targetDate) updateMilestoneData.target_date = targetDate;
          if (actualDate) updateMilestoneData.actual_date = actualDate;
          if (mStatus) updateMilestoneData.status = mStatus;
          if (mNotes || existingM.notes) updateMilestoneData.notes = mNotes || existingM.notes;

          await supabase
            .from('milestones')
            .update(updateMilestoneData)
            .eq('id', existingM.id);
        } else {
          await supabase.from('milestones').insert({
            transaction_id: transactionId,
            milestone_type: mKey,
            target_date: targetDate,
            actual_date: actualDate,
            status: mStatus || 'pending',
            source: 'sisu',
            notes: mNotes,
          });
        }
      }

      // =======================================================================
      // Task-Level Reconciliation
      // =======================================================================
      let txTasks = extractTasksFromSisuData(sisuData);
      if (!txTasks || txTasks.length === 0) {
        try {
          txTasks = await fetchSisuTransactionTasks(sisuTxId, sisuApiBaseUrl, sisuApiKey);
        } catch (taskErr: any) {
          console.warn(`[Reconciliation] Error fetching tasks for tx ${sisuTxId}:`, taskErr.message || taskErr);
          txTasks = [];
        }
      }

      if (Array.isArray(txTasks) && txTasks.length > 0) {
        const { data: activeMappings } = await supabase
          .from('sisu_task_mappings')
          .select('*')
          .eq('active', true);

        const mappingMap = new Map<string, any>();
        (activeMappings || []).forEach((m: any) => {
          if (m.sisu_task_name) {
            mappingMap.set(m.sisu_task_name.trim(), m);
            mappingMap.set(m.sisu_task_name.trim().toLowerCase(), m);
          }
        });

        // Refetch latest milestones for transaction
        const { data: currentMilestones } = await supabase
          .from('milestones')
          .select('*')
          .eq('transaction_id', transactionId);

        const latestMilestoneMap = new Map<string, any>();
        (currentMilestones || []).forEach((m: any) => latestMilestoneMap.set(m.milestone_type, m));

        const receiptDate = new Date().toISOString().split('T')[0];

        for (const task of txTasks) {
          const { name: taskName, isComplete, completionDate } = parseTaskDetails(task);
          if (!taskName) continue;

          const matchedMapping = mappingMap.get(taskName) || mappingMap.get(taskName.toLowerCase());

          if (matchedMapping) {
            const targetField = matchedMapping.milestone_field;

            if (isComplete) {
              const actualDate = completionDate || receiptDate;
              const existingM = latestMilestoneMap.get(targetField);

              if (existingM) {
                const isManual = existingM.source === 'manual';
                const manualUpdatedAt = new Date(existingM.updated_at).getTime();

                if (isManual && manualUpdatedAt >= sisuUpdatedAt) {
                  if (existingM.actual_date !== actualDate || (existingM.status !== 'complete' && existingM.status !== 'satisfied')) {
                    conflictsFound++;
                    txConflicts++;

                    await supabase.from('sync_conflicts').insert({
                      transaction_id: transactionId,
                      sisu_transaction_id: sisuTxId,
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
                      resolution_notes: `Reconciliation: manual edit preserved; task '${taskName}' overwrite prevented.`,
                    });
                    continue;
                  }
                }

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
            try {
              await supabase.from('sisu_unmatched_tasks').insert({
                task_name: taskName,
                transaction_id: sisuTxId,
                detected_at: new Date().toISOString(),
                task_payload: task,
              });
            } catch (unmatchedErr: any) {
              console.warn('[Reconciliation] Could not insert sisu_unmatched_tasks:', unmatchedErr.message || unmatchedErr);
            }
          }
        }
      }

      // Reconcile custom transaction form fields
      const fullCustom: Record<string, any> = {
        ...(sisuData?.custom || {}),
        ...(sisuData?.object_data?.full_object?.custom || {}),
      };
      const hasFullCustomState = Object.keys(fullCustom).length > 0;

      // Helper: evaluate Yes / No / Cleared boolean state
      const evaluateBooleanValue = (val: any): { isYes: boolean; isNo: boolean } => {
        if (val === null || val === undefined) return { isYes: false, isNo: true };
        const strVal = String(val).trim().toLowerCase();
        if (
          strVal === '' ||
          strVal === 'none' ||
          strVal === 'null' ||
          strVal === 'unmarked' ||
          strVal === '- select -' ||
          strVal === 'select one' ||
          strVal === '-1' ||
          strVal === 'n/a' ||
          strVal === 'undefined'
        ) {
          return { isYes: false, isNo: true };
        }

        // Sisu Multiple Choice form fields store the 0-based option index:
        // Option 1 ("Yes") -> "0"
        // Option 2 ("No")  -> "1"
        // Also handles literal strings "yes", "y", "completed", "satisfied", "done", boolean true
        const isYes =
          strVal === '0' ||
          strVal === 'yes' ||
          strVal === 'true' ||
          strVal === 'y' ||
          strVal === 'completed' ||
          strVal === 'satisfied' ||
          strVal === 'done' ||
          val === true;

        // Option 2 ("No") -> "1", or literal strings "no", "n", "false", boolean false
        const isNo =
          strVal === '1' ||
          strVal === 'no' ||
          strVal === 'false' ||
          strVal === 'n' ||
          val === false;

        return { isYes, isNo };
      };

      const customEntries = Object.entries(fullCustom);
      if (customEntries.length > 0 || hasFullCustomState) {
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

        const getTargetFields = (fieldKey: string): string[] => {
          const rawKey = fieldKey.trim();
          const lowerKey = rawKey.toLowerCase();
          const baseKey = lowerKey.replace(/(_?s_?\d+)$/i, '').trim();
          const strippedKey = baseKey.replace(/[\(\[\{]?internal\s*use[\)\]\}]?/gi, '').trim();
          const cleanKey = strippedKey.replace(/[_\s\-]+/g, ' ').trim();
          const normalizedKey = cleanKey.replace(/[^a-z0-9]/g, '');
          const rawNormalized = lowerKey.replace(/[^a-z0-9]/g, '');

          const matched =
            mappingMap.get(rawKey) ||
            mappingMap.get(lowerKey) ||
            mappingMap.get(baseKey) ||
            mappingMap.get(strippedKey) ||
            mappingMap.get(cleanKey) ||
            mappingMap.get(normalizedKey) ||
            mappingMap.get(rawNormalized);

          if (matched) return [matched.milestone_field];

          const targets: string[] = [];
          if (normalizedKey.includes('earnest') || normalizedKey.includes('emd') || rawNormalized.includes('earnest')) {
            targets.push('earnest_money');
          } else if (normalizedKey.includes('inspection') || rawNormalized.includes('inspection')) {
            if (
              normalizedKey.includes('ordr') ||
              normalizedKey.includes('order') ||
              normalizedKey.includes('sched') ||
              normalizedKey.includes('book') ||
              rawNormalized.includes('ordr') ||
              rawNormalized.includes('order')
            ) {
              targets.push('inspection_ordered');
            } else if (
              normalizedKey.includes('satisf') ||
              normalizedKey.includes('complet') ||
              normalizedKey.includes('10day') ||
              normalizedKey.includes('resolut') ||
              normalizedKey.includes('pass') ||
              rawNormalized.includes('satisf') ||
              rawNormalized.includes('complet')
            ) {
              targets.push('inspection_10day');
            } else {
              targets.push('inspection_ordered');
            }
          } else if (normalizedKey.includes('appraisal') || rawNormalized.includes('appraisal')) {
            if (
              normalizedKey.includes('satisf') ||
              normalizedKey.includes('met') ||
              normalizedKey.includes('condit') ||
              normalizedKey.includes('pass') ||
              rawNormalized.includes('satisf')
            ) {
              targets.push('appraisal_satisfied');
            } else if (
              normalizedKey.includes('receiv') ||
              normalizedKey.includes('in') ||
              normalizedKey.includes('deliver') ||
              normalizedKey.includes('got') ||
              rawNormalized.includes('receiv')
            ) {
              targets.push('appraisal_received');
            } else if (normalizedKey.includes('ordr') || normalizedKey.includes('order') || normalizedKey.includes('sched')) {
              targets.push('appraisal_ordered');
            } else {
              targets.push('appraisal_satisfied');
            }
          } else if (
            normalizedKey.includes('insurance') ||
            normalizedKey.includes('binder') ||
            rawNormalized.includes('insurance')
          ) {
            targets.push('insurance_binder');
          } else if (normalizedKey.includes('title') || rawNormalized.includes('title')) {
            targets.push('title');
          } else if (
            normalizedKey.includes('financ') ||
            normalizedKey.includes('loan') ||
            normalizedKey.includes('commit') ||
            rawNormalized.includes('financ') ||
            rawNormalized.includes('loan')
          ) {
            targets.push('financing_contingency');
          } else if (
            normalizedKey.includes('ctc') ||
            normalizedKey.includes('cleartoclose') ||
            (normalizedKey.includes('clear') && normalizedKey.includes('close')) ||
            rawNormalized.includes('cleartoclose') ||
            rawNormalized.includes('ctc')
          ) {
            targets.push('ctc');
          } else if (
            normalizedKey.includes('walk') ||
            normalizedKey.includes('walkthrough') ||
            rawNormalized.includes('walkthrough')
          ) {
            targets.push('walk_through');
          } else if (
            normalizedKey.includes('closing') ||
            normalizedKey.includes('closed') ||
            normalizedKey.includes('settlement')
          ) {
            targets.push('closing');
          }
          return targets;
        };

        for (const [key, rawValue] of customEntries) {
          const { isYes, isNo } = evaluateBooleanValue(rawValue);
          const targetFields = getTargetFields(key);

          if (targetFields.length > 0) {
            for (const targetField of targetFields) {
              const existingM = latestMilestoneMap.get(targetField);
              if (isYes) {
                if (existingM) {
                  await supabase
                    .from('milestones')
                    .update({
                      actual_date: receiptDate,
                      status: 'complete',
                      source: 'sisu',
                      notes: `Completed via Sisu form: ${key}`,
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', existingM.id);

                  latestMilestoneMap.set(targetField, {
                    ...existingM,
                    actual_date: receiptDate,
                    status: 'complete',
                    source: 'sisu',
                    notes: `Completed via Sisu form: ${key}`,
                  });
                } else {
                  await supabase.from('milestones').insert({
                    transaction_id: transactionId,
                    milestone_type: targetField,
                    actual_date: receiptDate,
                    status: 'complete',
                    source: 'sisu',
                    notes: `Completed via Sisu form: ${key}`,
                  });
                }
              } else if (
                isNo &&
                existingM &&
                (existingM.status === 'complete' || existingM.status === 'satisfied') &&
                (existingM.source === 'sisu' || existingM.notes?.includes('Completed via Sisu form:'))
              ) {
                await supabase
                  .from('milestones')
                  .update({
                    status: 'pending',
                    actual_date: null,
                    notes: null,
                    source: 'sisu',
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', existingM.id);

                latestMilestoneMap.set(targetField, {
                  ...existingM,
                  status: 'pending',
                  actual_date: null,
                  notes: null,
                  source: 'sisu',
                });
              }
            }
          }
        }

        // State-reconciliation sweep for nightly job: only revert if the field is present in the snapshot and explicitly NOT Yes
        if (hasFullCustomState) {
          for (const [mType, existingM] of latestMilestoneMap.entries()) {
            if (
              (existingM.status === 'complete' || existingM.status === 'satisfied') &&
              existingM.notes &&
              existingM.notes.startsWith('Completed via Sisu form: ')
            ) {
              const originatingKey = existingM.notes.replace('Completed via Sisu form: ', '').trim();
              if (originatingKey in fullCustom) {
                const currentVal = fullCustom[originatingKey];
                const { isYes } = evaluateBooleanValue(currentVal);

                if (!isYes) {
                  await supabase
                    .from('milestones')
                    .update({
                      status: 'pending',
                      actual_date: null,
                      notes: null,
                      source: 'sisu',
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', existingM.id);

                  latestMilestoneMap.set(mType, {
                    ...existingM,
                    status: 'pending',
                    actual_date: null,
                    notes: null,
                    source: 'sisu',
                  });
                }
              }
            }
          }
        }

        if (transactionId) {
          const finalTxUpdates: Record<string, any> = {
            updated_at: new Date().toISOString(),
          };
          if (hasFullCustomState) {
            finalTxUpdates.custom_fields = {
              ...((existingTx?.custom_fields as Record<string, any>) || {}),
              ...fullCustom,
            };
          }
          await supabase
            .from('transactions')
            .update(finalTxUpdates)
            .eq('id', transactionId);
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
