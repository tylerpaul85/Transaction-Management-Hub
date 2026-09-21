// Reusable helper to construct and format agent weekly update email overview

export interface DigestTransactionItem {
  id: string;
  property_address: string;
  client_name: string;
  side: 'buyer' | 'seller' | string;
  contract_date?: string | null;
  target_closing_date?: string | null;
  custom_fields?: Record<string, any> | null;
  next_milestone?: {
    type: string;
    label: string;
    target_date: string | null;
    status: string;
  } | null;
  overdue_milestones: Array<{
    type: string;
    label: string;
    target_date: string | null;
    status: string;
    days_overdue: number;
  }>;
  milestones?: Array<{
    milestone_type: string;
    status: string;
    target_date?: string | null;
    actual_date?: string | null;
  }>;
}

export const MILESTONE_LABELS: Record<string, string> = {
  earnest_money: 'Earnest Money Deposit',
  inspection_ordered: 'Inspection Ordered',
  inspection_notice_sent: 'Inspection Notice Sent',
  inspection_10day: '10-Day Inspection Resolution',
  sale_contingency: 'Home Sale Contingency',
  financing_contingency: 'Loan Commitment / Financing',
  appraisal_ordered: 'Appraisal Ordered',
  appraisal_received: 'Appraisal Received',
  appraisal_satisfied: 'Appraisal Condition Clearance',
  insurance_binder: 'Insurance Binder Obtained',
  title: 'Title Commitment Review',
  walk_through: 'Final Walkthrough',
  ctc: 'Clear-to-Close (CTC)',
  closing: 'Closing & Settlement',
};

export const MILESTONE_ORDER_SEQUENCE = [
  { key: 'earnest_money', shortLabel: 'EMD', label: 'Earnest Money Deposit' },
  { key: 'inspection', shortLabel: 'INSP', label: 'Home Inspection', subKeys: ['inspection_ordered', 'inspection_10day'] },
  { key: 'financing_contingency', shortLabel: 'FIN', label: 'Loan Commitment' },
  { key: 'appraisal', shortLabel: 'APP', label: 'Appraisal', subKeys: ['appraisal_received', 'appraisal_satisfied'] },
  { key: 'insurance_binder', shortLabel: 'INS', label: 'Insurance Binder' },
  { key: 'title', shortLabel: 'TITLE', label: 'Title Clearance' },
  { key: 'ctc', shortLabel: 'CTC', label: 'Clear to Close' },
  { key: 'walk_through', shortLabel: 'WALK', label: 'Final Walkthrough' },
];

export function isFieldComplete(
  mType: string,
  milestones?: Array<{ milestone_type: string; status: string }>,
  customFields?: Record<string, any> | null
): boolean {
  const list = milestones || [];
  const found = list.find((m) => m.milestone_type === mType);
  const s = (found?.status || '').toLowerCase();
  if (s === 'complete' || s === 'satisfied' || s === 'waived') return true;

  if (customFields && typeof customFields === 'object') {
    const cfMap: Record<string, string[]> = {
      earnest_money: ['earnest_money_depositeds_63', 'earnest_money_deposited'],
      inspection_ordered: ['inspection_completeds_63', 'inspection_completed'],
      inspection_10day: ['inspection_satisfieds_63', 'inspection_satisfied'],
      financing_contingency: [
        'financing_/_loan_commitment_-_internal_use',
        'financing_loan_commitment_internal_use',
        'financing_loan_commitment',
      ],
      appraisal_received: ['appraisal_received', 'appraisal_received_internal_use'],
      appraisal_satisfied: ['appraisal_satisfied', 'appraisal_satisfied_internal_use'],
      insurance_binder: ['insurance_obtaineds_63', 'insurance_obtained', 'insurance_obtained_internal_use'],
      title: ['title_commitment_s_38_clearance', 'title_commitment_clearance_internal_use', 'title_commitment'],
      ctc: ['clear-to-close_(ctc)', 'clear_to_close_internal_use', 'clear-to-close', 'clear_to_close'],
      walk_through: ['final_walkthrough', 'final_walkthrough_internal_use'],
    };

    const keys = cfMap[mType] || [];
    for (const k of keys) {
      const v = customFields[k];
      if (
        v === '0' ||
        v === true ||
        String(v).toLowerCase() === 'yes' ||
        String(v).toLowerCase() === 'true'
      ) {
        return true;
      }
    }
  }

  return false;
}

export function renderMilestoneSequenceHtml(
  milestones?: Array<{ milestone_type: string; status: string }>,
  customFields?: Record<string, any> | null
): string {
  const list = milestones || [];

  const pillsHtml = MILESTONE_ORDER_SEQUENCE.map((item, idx) => {
    let status = 'pending';
    let isHalf = false;

    if (item.subKeys && item.subKeys.length > 0) {
      const allDone = item.subKeys.every((sk) => isFieldComplete(sk, list, customFields));
      const anyDone = item.subKeys.some((sk) => isFieldComplete(sk, list, customFields));

      if (allDone) {
        status = 'satisfied';
      } else if (anyDone) {
        status = 'in_progress';
        isHalf = true;
      } else {
        status = 'pending';
      }
    } else {
      const done = isFieldComplete(item.key, list, customFields);
      if (done) {
        status = 'satisfied';
      } else {
        const match = list.find((m) => m.milestone_type === item.key);
        status = (match?.status || 'pending').toLowerCase();
      }
    }

    let bg = '#d97706';
    let text = '#0f172a';
    let border = '#f59e0b';

    if (status === 'satisfied' || status === 'complete') {
      bg = '#10b981';
      text = '#0f172a';
      border = '#34d399';
    } else if (status === 'in_progress' || status === 'ordered' || status === 'notice_sent') {
      bg = '#0ea5e9';
      text = '#0f172a';
      border = '#38bdf8';
    } else if (status === 'waived') {
      bg = '#6366f1';
      text = '#ffffff';
      border = '#818cf8';
    } else if (status === 'na') {
      bg = '#1e293b';
      text = '#64748b';
      border = '#334155';
    }

    const pill = `<span style="display: inline-block; padding: 2.5px 8px; border-radius: 9999px; font-size: 9px; font-family: monospace, sans-serif; font-weight: 800; background-color: ${bg}; color: ${text}; border: 1px solid ${border}; vertical-align: middle;">${item.shortLabel}${isHalf ? ' <span style="font-size: 8px; opacity: 0.85;">½</span>' : ''}</span>`;

    const connector =
      idx < MILESTONE_ORDER_SEQUENCE.length - 1
        ? `<span style="display: inline-block; width: 6px; height: 2px; background-color: #334155; vertical-align: middle; margin: 0 1.5px;"></span>`
        : '';

    return pill + connector;
  }).join('');

  return `
    <div style="margin-top: 12px; padding: 10px 12px; background-color: #141c2e; border: 1px solid #293548; border-radius: 10px;">
      <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;">
        ESCROW MILESTONE PROGRESS:
      </div>
      <div style="line-height: 1.6; white-space: nowrap; overflow-x: auto;">
        ${pillsHtml}
      </div>
    </div>
  `;
}

export function renderAgentDigestEmail(params: {
  agentName: string;
  agentEmail: string;
  transactions: DigestTransactionItem[];
  frequencyName?: string;
}): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    agentName,
    agentEmail,
    transactions,
    frequencyName = 'Weekly',
  } = params;

  const totalDeals = transactions.length;
  const totalOverdueCount = transactions.reduce(
    (acc, t) => acc + (t.overdue_milestones?.length || 0),
    0
  );

  const subject =
    totalOverdueCount > 0
      ? `🚨 Action Required: ${totalOverdueCount} Overdue Item${
          totalOverdueCount === 1 ? '' : 's'
        } — ${frequencyName} Digest for ${agentName}`
      : `📋 Your ${frequencyName} Active Escrow Digest (${totalDeals} Deal${
          totalDeals === 1 ? '' : 's'
        }) — MSREG Hub`;

  const transactionRowsHtml = transactions
    .map((tx) => {
      const sideColor = tx.side.toLowerCase() === 'buyer' ? '#10b981' : '#d97706';
      const sideBg = tx.side.toLowerCase() === 'buyer' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(217, 119, 6, 0.12)';
      const sideBorder = tx.side.toLowerCase() === 'buyer' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(217, 119, 6, 0.3)';

      const milestoneSeqHtml = renderMilestoneSequenceHtml(tx.milestones, tx.custom_fields);

      const overdueHtml =
        tx.overdue_milestones && tx.overdue_milestones.length > 0
          ? `
          <div style="margin-top: 12px; padding: 12px; background-color: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 8px;">
            <div style="font-size: 11px; font-weight: 800; color: #ef4444; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
              ⚠️ Overdue Milestones (Action Required)
            </div>
            ${tx.overdue_milestones
              .map(
                (o) => `
              <div style="font-size: 13px; color: #f8fafc; margin-bottom: 4px; line-height: 1.4;">
                <strong style="color: #ef4444; font-weight: 700;">${o.label}:</strong> Target was <span style="font-family: monospace; font-weight: 700; color: #ef4444;">${o.target_date || 'N/A'}</span> (${o.days_overdue} day${o.days_overdue === 1 ? '' : 's'} past due — status: <span style="text-transform: capitalize;">${o.status}</span>)
              </div>
            `
              )
              .join('')}
          </div>
        `
          : '';

      const upcomingHtml = tx.next_milestone
        ? `
        <div style="margin-top: 10px; padding: 10px 12px; background-color: #1a2235; border-radius: 8px; border: 1px solid #334155; font-size: 13px;">
          <span style="color: #94a3b8; font-size: 11px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">Next Target Milestone</span>
          <span style="color: #f8fafc; font-weight: 600;">${tx.next_milestone.label}</span>
          <span style="color: #d97706; font-weight: 700; font-family: monospace; margin-left: 8px;">Target: ${tx.next_milestone.target_date || 'TBD'}</span>
        </div>
      `
        : `
        <div style="margin-top: 10px; font-size: 12px; color: #94a3b8;">
          All scheduled contingencies up to date.
        </div>
      `;

      return `
        <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 18px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div>
              <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 800; text-transform: uppercase; color: ${sideColor}; background-color: ${sideBg}; border: 1px solid ${sideBorder}; margin-bottom: 6px;">
                ${tx.side} Representation
              </span>
              <h3 style="margin: 0 0 4px 0; font-size: 17px; font-weight: 700; color: #f8fafc;">
                ${tx.property_address}
              </h3>
              <div style="font-size: 13px; color: #94a3b8;">
                Client: <strong style="color: #f8fafc;">${tx.client_name}</strong>
                ${tx.target_closing_date ? ` • Target Close: <span style="color: #f8fafc; font-family: monospace;">${tx.target_closing_date}</span>` : ''}
              </div>
            </div>
          </div>

          ${milestoneSeqHtml}
          ${upcomingHtml}
          ${overdueHtml}
        </div>
      `;
    })
    .join('');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #d97706; margin: 0 0 6px 0; font-size: 24px;">Matt Smith Real Estate Group</h1>
      <div style="color: #94a3b8; font-size: 14px;">${subject}</div>
    </div>
    <div style="background-color: #1e293b; border-radius: 16px; padding: 20px; border: 1px solid #334155; margin-bottom: 24px;">
      <h2 style="margin: 0 0 8px 0; font-size: 18px; color: #f8fafc;">Hello ${agentName},</h2>
      <p style="margin: 0; font-size: 14px; color: #cbd5e1; line-height: 1.5;">
        Here is your transaction overview report (${totalDeals} active escrow${totalDeals === 1 ? '' : 's'}).
      </p>
    </div>
    ${transactionRowsHtml}
    <div style="text-align: center; font-size: 11px; color: #64748b; padding-top: 16px; border-top: 1px solid #334155;">
      Sent automatically to ${agentEmail} • MSREG Operations
    </div>
  </div>
</body>
</html>
`;

  const text = `
Matt Smith Real Estate Group - ${frequencyName} Agent Transaction Digest
Hello ${agentName},

You currently have ${totalDeals} active escrow(s).

${transactions
  .map(
    (t) => {
      const milestoneText = (t.milestones || [])
        .map((m) => `${m.milestone_type}: ${m.status}`)
        .join(' | ');

      return `
- ${t.property_address} (${t.side} Rep)
  Client: ${t.client_name}
  Target Closing: ${t.target_closing_date || 'N/A'}
  Milestones: ${milestoneText || 'In progress'}
  Next Milestone: ${t.next_milestone ? `${t.next_milestone.label} (${t.next_milestone.target_date})` : 'Up to date'}
  ${t.overdue_milestones.length > 0 ? `Overdue Items: ${t.overdue_milestones.map((o) => o.label).join(', ')}` : ''}
`;
    }
  )
  .join('\n')}
`;

  return { subject, html, text };
}
