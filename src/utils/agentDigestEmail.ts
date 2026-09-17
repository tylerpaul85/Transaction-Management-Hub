// Reusable helper to construct and format agent weekly update email overview

export interface DigestTransactionItem {
  id: string;
  property_address: string;
  client_name: string;
  side: 'buyer' | 'seller' | string;
  contract_date?: string | null;
  target_closing_date?: string | null;
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
  title: 'Title Commitment Review',
  walk_through: 'Final Walkthrough',
  ctc: 'Clear-to-Close (CTC)',
  closing: 'Closing & Settlement',
};

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
    (t) => `
- ${t.property_address} (${t.side} Rep)
  Client: ${t.client_name}
  Target Closing: ${t.target_closing_date || 'N/A'}
  Next Milestone: ${t.next_milestone ? `${t.next_milestone.label} (${t.next_milestone.target_date})` : 'Up to date'}
  ${t.overdue_milestones.length > 0 ? `Overdue Items: ${t.overdue_milestones.map((o) => o.label).join(', ')}` : ''}
`
  )
  .join('\n')}
`;

  return { subject, html, text };
}
