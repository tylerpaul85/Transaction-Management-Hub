import { supabase } from '../integrations/supabase/client';

export interface TaskApprovalData {
  approvalStatus: 'pending_tc_approval' | 'approved' | 'changes_requested';
  details: string;
  submittedByName: string;
  submittedByEmail?: string;
  submittedAt: string;
  assignedTcName?: string;
  assignedTcEmail?: string;
  documentLink?: string;
  tcNotes?: string;
  tcReviewedAt?: string;
  tcReviewedBy?: string;
}

const PREFIX = '---MSREG_TASK_APPROVAL---';

/**
 * Parses task approval metadata stored inside milestone notes.
 */
export function parseTaskApproval(notes: string | null | undefined): {
  approvalData: TaskApprovalData | null;
  cleanNotes: string;
} {
  if (!notes || typeof notes !== 'string') {
    return { approvalData: null, cleanNotes: '' };
  }

  const idx = notes.indexOf(PREFIX);
  if (idx === -1) {
    // Check if it's pure JSON
    if (notes.trim().startsWith('{') && notes.includes('"approvalStatus"')) {
      try {
        const parsed = JSON.parse(notes.trim()) as TaskApprovalData;
        return { approvalData: parsed, cleanNotes: '' };
      } catch {
        // Fallback to plain text
      }
    }
    return { approvalData: null, cleanNotes: notes };
  }

  const cleanNotes = notes.slice(0, idx).trim();
  const jsonStr = notes.slice(idx + PREFIX.length).trim();
  try {
    const approvalData = JSON.parse(jsonStr) as TaskApprovalData;
    return { approvalData, cleanNotes };
  } catch (err) {
    console.warn('Could not parse task approval data JSON:', err);
    return { approvalData: null, cleanNotes: notes };
  }
}

/**
 * Encodes task approval metadata into a milestone notes string.
 */
export function encodeTaskApproval(
  approvalData: TaskApprovalData,
  existingNotes?: string | null
): string {
  // If existing notes already had an approval block, clean it first
  const { cleanNotes } = parseTaskApproval(existingNotes);
  const jsonStr = JSON.stringify(approvalData);
  if (cleanNotes) {
    return `${cleanNotes}\n\n${PREFIX}\n${jsonStr}`;
  }
  return `${PREFIX}\n${jsonStr}`;
}

/**
 * Dispatches an automated email notification to the assigned TC when an agent submits a task.
 */
export async function notifyTcOfTaskSubmission(params: {
  tcName: string;
  tcEmail: string;
  agentName: string;
  agentEmail?: string;
  propertyAddress: string;
  taskTitle: string;
  details: string;
  completionDate?: string;
  transactionId?: string;
}): Promise<{ success: boolean; resendMessageId?: string; emailsSent?: number; error?: string }> {
  const {
    tcName,
    tcEmail,
    agentName,
    agentEmail,
    propertyAddress,
    taskTitle,
    details,
    completionDate = new Date().toISOString().split('T')[0],
    transactionId,
  } = params;

  if (!tcEmail || !tcEmail.includes('@')) {
    console.warn('Cannot notify TC: No valid TC email provided', tcEmail);
    return { success: false, error: 'No valid TC email provided' };
  }

  const subject = `Action Required: Task Completion Approval for ${propertyAddress} — ${taskTitle}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #131826; border: 1px solid #334155; border-radius: 16px; overflow: hidden;">
          <tr>
            <td style="padding: 24px; background: linear-gradient(180deg, #1e293b 0%, #131826 100%); border-bottom: 1px solid #334155;">
              <span style="display: inline-block; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #f59e0b; background-color: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); padding: 4px 10px; border-radius: 9999px; margin-bottom: 8px;">
                Task Review Required
              </span>
              <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #f8fafc;">
                ${taskTitle}
              </h2>
              <div style="font-size: 14px; color: #38bdf8; font-weight: 600;">
                ${propertyAddress}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px; color: #cbd5e1; font-size: 14px; line-height: 1.6;">
              <p style="margin: 0 0 16px 0;">
                Hi <strong>${tcName}</strong>,
              </p>
              <p style="margin: 0 0 16px 0;">
                <strong>${agentName}</strong> has submitted details to mark this task complete and is awaiting your final TC verification:
              </p>

              <div style="background-color: #090e17; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 14px 16px; margin: 16px 0;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 4px;">
                  Agent Submission Notes:
                </div>
                <div style="font-size: 14px; color: #f8fafc; font-weight: 500; white-space: pre-wrap;">
                  ${details.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                </div>
                <div style="margin-top: 8px; font-size: 11px; color: #64748b;">
                  Date Completed: <strong>${completionDate}</strong> • Submitted: <strong>${new Date().toLocaleDateString('en-US')}</strong>
                </div>
              </div>

              <p style="margin: 20px 0 0 0;">
                Please log into the <strong>Transaction Management Hub</strong> to review and make the final approval:
              </p>

              <div style="margin-top: 20px; text-align: center;">
                <a href="https://hub.msreg.com/agent-deals" style="display: inline-block; background-color: #10b981; color: #022c22; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 10px; text-decoration: none;">
                  Review & Approve in Hub
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 24px; background-color: #0b1120; border-top: 1px solid #1e293b; font-size: 11px; color: #64748b; text-align: center;">
              Matt Smith Real Estate Group • Automated TC Workflow Notification
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  try {
    // 1. Resolve a valid Supabase transaction ID so weekly-agent-digest does not skip zero-deals agents
    let resolvedTxId = transactionId;
    const isUuid = (id?: string) =>
      Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

    if (!isUuid(resolvedTxId)) {
      const { data: anyPending } = await (supabase.from('transactions') as any)
        .select('id')
        .not('status', 'ilike', '%closed%')
        .not('status', 'ilike', '%lost%')
        .not('status', 'ilike', '%terminate%')
        .limit(1)
        .maybeSingle();

      if (anyPending?.id) {
        resolvedTxId = anyPending.id;
      }
    }

    const targetTxIds = resolvedTxId ? [resolvedTxId] : undefined;

    // Collect recipient emails (including alias if Katie Harold)
    const targetRecipients: Array<{ name: string; email: string; target_transaction_ids?: string[] }> = [
      {
        name: tcName,
        email: tcEmail,
        target_transaction_ids: targetTxIds,
      },
    ];

    // If Katie Harold, ensure both katie@ and katie.harold@ are notified
    if (tcEmail.toLowerCase().includes('katie') && !tcEmail.toLowerCase().includes('katie.harold')) {
      targetRecipients.push({
        name: tcName,
        email: 'katie.harold@mattsmithrealestategroup.com',
        target_transaction_ids: targetTxIds,
      });
    } else if (tcEmail.toLowerCase().includes('katie.harold')) {
      targetRecipients.push({
        name: tcName,
        email: 'katie@mattsmithrealestategroup.com',
        target_transaction_ids: targetTxIds,
      });
    }

    const { data, error } = await supabase.functions.invoke('weekly-agent-digest', {
      body: {
        agent_name: tcName,
        agent_email: tcEmail,
        subject,
        html,
        target_agents: targetRecipients,
        target_transaction_ids: targetTxIds,
      },
    });

    if (error) {
      console.error('Could not dispatch TC task notification email:', error);
      return { success: false, error: error.message };
    }

    const emailsSent = data?.summary?.emails_sent || 0;
    const resendMsgId = data?.summary?.dispatches?.[0]?.resend_message_id;

    if (emailsSent > 0) {
      console.log(`Dispatched task approval notification to TC ${tcName} (${tcEmail}). Resend ID: ${resendMsgId}`);
      return { success: true, resendMessageId: resendMsgId, emailsSent };
    } else {
      console.warn('Edge function completed but reported zero emails sent:', data);
      return { success: false, emailsSent: 0, error: 'Email service skipped dispatch' };
    }
  } catch (err: any) {
    console.error('Error invoking task approval notification:', err);
    return { success: false, error: err.message };
  }
}
