// Supabase Edge Function: weekly-agent-digest
// Scheduled to run every Monday at 7:00 AM Central (pg_cron: '0 7 * * 1')
// Sends customized escrow digest emails to all active agents via Resend.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  renderAgentDigestEmail,
  MILESTONE_LABELS,
  DigestTransactionItem,
} from './email-template.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const report = {
    started_at: new Date().toISOString(),
    total_agents_evaluated: 0,
    emails_sent: 0,
    agents_skipped_zero_deals: 0,
    errors_count: 0,
    dispatches: [] as Array<{
      agent_id: string;
      agent_name: string;
      agent_email: string;
      transaction_count: number;
      resend_message_id: string | null;
      status: 'sent' | 'skipped' | 'failed';
      error?: string;
    }>,
  };

  try {
    const body = await req.json().catch(() => ({}));
    const targetAgentId = body?.agent_id;
    const targetAgentEmail = body?.agent_email;
    const targetAgentName = body?.agent_name;
    const targetAgentsList: Array<{ id?: string; name: string; email: string }> | undefined = body?.target_agents;

    const resendApiKey = Deno.env.get('RESEND_API_KEY') || body?.resend_api_key || '';
    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || body?.from_email || 'MSREG Operations <onboarding@resend.dev>';
    const appBaseUrl = Deno.env.get('APP_BASE_URL') || body?.app_base_url || 'https://hub.msreg.com';

    // 1. Fetch active agents (or single targeted agent, or explicit list)
    let activeAgents: Array<{ id: string; name: string; email: string; phone?: string; active?: boolean }> = [];

    if (Array.isArray(targetAgentsList) && targetAgentsList.length > 0) {
      activeAgents = targetAgentsList.map((a, idx) => ({
        id: a.id || `agent-target-${idx}`,
        name: a.name || 'Agent',
        email: a.email || 'agent@mattsmithrealestategroup.com',
        phone: '',
        active: true,
      }));
    } else {
      let agentQuery = supabase
        .from('agents')
        .select('id, name, email, phone, active')
        .eq('active', true);

      if (targetAgentId) {
        agentQuery = agentQuery.eq('id', targetAgentId);
      } else if (targetAgentEmail) {
        agentQuery = agentQuery.eq('email', targetAgentEmail);
      } else if (targetAgentName) {
        agentQuery = agentQuery.ilike('name', `%${targetAgentName}%`);
      }

      const { data: dbAgents, error: agentsError } = await agentQuery;

      if (agentsError) {
        console.warn(`Warning querying active agents: ${agentsError.message}`);
      }

      activeAgents = dbAgents || [];

      // Fallback for single targeted agent if not found in agents table directly
      if (activeAgents.length === 0 && (targetAgentEmail || targetAgentName)) {
        activeAgents = [
          {
            id: targetAgentId || 'agent-target-id',
            name: targetAgentName || targetAgentEmail?.split('@')[0] || 'Agent',
            email: targetAgentEmail || 'agent@mattsmithrealestategroup.com',
            phone: '',
            active: true,
          },
        ];
      }
    }

    report.total_agents_evaluated = activeAgents?.length || 0;
    const todayStr = new Date().toISOString().split('T')[0];

    // 2. Process each agent
    for (const agent of activeAgents || []) {
      let resolvedAgentId = agent.id;
      if (!resolvedAgentId || resolvedAgentId.startsWith('agent-target')) {
        const { data: matchedAgent } = await supabase
          .from('agents')
          .select('id, name, email')
          .or(`email.ilike.${agent.email},name.ilike.%${agent.name}%`)
          .limit(1);
        if (matchedAgent && matchedAgent.length > 0) {
          resolvedAgentId = matchedAgent[0].id;
          agent.id = resolvedAgentId;
          agent.name = matchedAgent[0].name || agent.name;
          if (!targetAgentEmail) {
            agent.email = matchedAgent[0].email || agent.email;
          }
        }
      }

      // Find all active transactions where this agent is listing or selling agent
      let txQuery = supabase
        .from('transactions')
        .select(`
          id,
          status,
          property_address,
          city,
          side,
          client_name,
          contract_date,
          target_closing_date,
          listing_agent_id,
          selling_agent_id,
          milestones (
            id,
            milestone_type,
            target_date,
            actual_date,
            status,
            source,
            notes
          )
        `)
        .not('status', 'in', '("closed","terminated")');

      if (resolvedAgentId && !resolvedAgentId.startsWith('agent-target')) {
        txQuery = txQuery.or(
          `listing_agent_id.eq.${resolvedAgentId},selling_agent_id.eq.${resolvedAgentId}`
        );
      }

      const { data: agentTransactions, error: txError } = await txQuery;

      if (txError) {
        console.error(`Error querying transactions for agent ${agent.name} (${agent.id}):`, txError);
        report.errors_count++;
        report.dispatches.push({
          agent_id: agent.id,
          agent_name: agent.name,
          agent_email: agent.email,
          transaction_count: 0,
          resend_message_id: null,
          status: 'failed',
          error: txError.message,
        });
        continue;
      }

      // Requirement: Skip agents with zero active transactions (don't send empty email)
      if (!agentTransactions || agentTransactions.length === 0) {
        report.agents_skipped_zero_deals++;
        report.dispatches.push({
          agent_id: agent.id,
          agent_name: agent.name,
          agent_email: agent.email,
          transaction_count: 0,
          resend_message_id: null,
          status: 'skipped',
        });
        continue;
      }

      // 3. Transform transactions and compute milestone deadlines
      const digestTransactions: DigestTransactionItem[] = agentTransactions.map((tx: any) => {
        const milestonesList: any[] = tx.milestones || [];

        // Identify overdue milestones: target_date < today AND status NOT IN ('satisfied', 'waived')
        const overdueMilestones = milestonesList
          .filter((m) => {
            if (!m.target_date) return false;
            const isCompleted = m.status === 'satisfied' || m.status === 'waived';
            return !isCompleted && m.target_date < todayStr;
          })
          .map((m) => {
            const targetMs = new Date(m.target_date).getTime();
            const nowMs = new Date(todayStr).getTime();
            const diffDays = Math.max(1, Math.round((nowMs - targetMs) / (1000 * 60 * 60 * 24)));

            return {
              type: m.milestone_type,
              label: MILESTONE_LABELS[m.milestone_type] || m.milestone_type,
              target_date: m.target_date,
              status: m.status,
              days_overdue: diffDays,
            };
          });

        // Identify next upcoming milestone: target_date >= today AND status NOT IN ('satisfied', 'waived')
        const pendingMilestones = milestonesList
          .filter((m) => {
            const isCompleted = m.status === 'satisfied' || m.status === 'waived';
            return !isCompleted && m.target_date && m.target_date >= todayStr;
          })
          .sort((a, b) => (a.target_date > b.target_date ? 1 : -1));

        const nextM = pendingMilestones.length > 0 ? pendingMilestones[0] : null;

        return {
          id: tx.id,
          property_address: tx.property_address,
          client_name: tx.client_name,
          side: tx.side,
          contract_date: tx.contract_date,
          target_closing_date: tx.target_closing_date,
          next_milestone: nextM
            ? {
                type: nextM.milestone_type,
                label: MILESTONE_LABELS[nextM.milestone_type] || nextM.milestone_type,
                target_date: nextM.target_date,
                status: nextM.status,
              }
            : null,
          overdue_milestones: overdueMilestones,
        };
      });

      // 4. Render executive email template
      const emailContent = renderAgentDigestEmail({
        agentName: agent.name,
        agentEmail: agent.email,
        transactions: digestTransactions,
        appBaseUrl,
        frequencyName: 'Weekly',
      });

      // 5. Send via Resend
      let resendMessageId: string | null = null;
      let sendStatus: 'sent' | 'failed' = 'sent';
      let sendError: string | null = null;

      if (resendApiKey) {
        try {
          let fromAddress = resendFromEmail;
          let resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: fromAddress,
              to: [agent.email],
              subject: emailContent.subject,
              html: emailContent.html,
              text: emailContent.text,
            }),
          });

          if (!resendResponse.ok) {
            const errJson = await resendResponse.json();
            if (errJson?.name === 'validation_error' || errJson?.message?.includes('not verified')) {
              console.warn('Unverified domain error from Resend API, retrying with onboarding@resend.dev...');
              fromAddress = 'MSREG Operations <onboarding@resend.dev>';
              resendResponse = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${resendApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  from: fromAddress,
                  to: [agent.email],
                  subject: emailContent.subject,
                  html: emailContent.html,
                  text: emailContent.text,
                }),
              });
            }

            if (!resendResponse.ok) {
              const errJson2 = await resendResponse.json();
              throw new Error(
                `Resend API error (${resendResponse.status}): ${JSON.stringify(errJson2)}`
              );
            }
          }

          const resendData = await resendResponse.json();
          resendMessageId = resendData.id || null;
        } catch (err: any) {
          sendStatus = 'failed';
          sendError = err.message || String(err);
          report.errors_count++;
          console.error(`Failed to send email to ${agent.email}:`, err);
        }
      } else {
        // Mock fallback mode when RESEND_API_KEY is not yet populated
        console.warn(`[Mock Email Send] RESEND_API_KEY not set. Mocking dispatch to ${agent.email}`);
        resendMessageId = `mock-resend-${Date.now()}-${agent.id.slice(0, 8)}`;
      }

      if (sendStatus === 'sent') {
        report.emails_sent++;
      }

      // 6. Log send to digest_log table
      await supabase.from('digest_log').insert({
        agent_id: agent.id,
        sent_at: new Date().toISOString(),
        transaction_count: digestTransactions.length,
        resend_message_id: resendMessageId,
        status: sendStatus,
        error: sendError,
        metadata: {
          recipient_email: agent.email,
          transactions_summary: digestTransactions.map((t) => ({
            id: t.id,
            address: t.property_address,
            overdue_count: t.overdue_milestones.length,
          })),
        },
      });

      report.dispatches.push({
        agent_id: agent.id,
        agent_name: agent.name,
        agent_email: agent.email,
        transaction_count: digestTransactions.length,
        resend_message_id: resendMessageId,
        status: sendStatus,
        error: sendError || undefined,
      });
    }

    const durationMs = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        duration_ms: durationMs,
        summary: report,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (globalErr: any) {
    console.error('Fatal error in weekly-agent-digest function:', globalErr);
    return new Response(
      JSON.stringify({
        success: false,
        error: globalErr.message || 'Internal server error in weekly-agent-digest',
        report,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
