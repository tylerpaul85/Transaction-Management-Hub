// MSREG Hub - Reusable Agent Transaction Digest Email Template
// Supports custom frequencies (Weekly, Daily, Friday Recap) and branding without changing data logic.

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

export interface DigestEmailParams {
  agentName: string;
  agentEmail: string;
  transactions: DigestTransactionItem[];
  appBaseUrl?: string;
  frequencyName?: string; // e.g. "Weekly", "Monday", "Friday Escrow Recap"
  title?: string;
  subtitle?: string;
}

export const ACTIVE_MILESTONES_SET = new Set([
  'earnest_money',
  'inspection_ordered',
  'inspection_10day',
  'financing_contingency',
  'appraisal_received',
  'appraisal_satisfied',
  'insurance_binder',
  'title',
  'ctc',
  'walk_through',
]);

export const MILESTONE_LABELS: Record<string, string> = {
  earnest_money: 'Earnest Money Deposited',
  inspection_ordered: 'Inspection Ordered',
  inspection_10day: 'Inspection Satisfied',
  financing_contingency: 'Financing / Loan Commitment',
  appraisal_received: 'Appraisal Received',
  appraisal_satisfied: 'Appraisal Satisfied',
  insurance_binder: 'Insurance Binder Obtained',
  title: 'Title Commitment & Clearance',
  ctc: 'Clear-to-Close (CTC)',
  walk_through: 'Final Walkthrough',
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
  const list = (milestones || []).filter((m) => ACTIVE_MILESTONES_SET.has(m.milestone_type));

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

export function renderAgentDigestEmail(params: DigestEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    agentName,
    agentEmail = 'agent@mattsmithrealestategroup.com',
    transactions,
    appBaseUrl = 'https://hub.msreg.com',
    frequencyName = 'Weekly',
    title = `${frequencyName} Agent Transaction Digest`,
    subtitle = `Here is your active escrow checklist and milestone status report.`,
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

  // Render HTML Transaction Rows
  const transactionRowsHtml = transactions
    .map((tx) => {
      const sideColor = tx.side.toLowerCase() === 'buyer' ? '#10b981' : '#d97706';
      const sideBg = tx.side.toLowerCase() === 'buyer' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(217, 119, 6, 0.12)';
      const sideBorder = tx.side.toLowerCase() === 'buyer' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(217, 119, 6, 0.3)';

      const milestoneSeqHtml = renderMilestoneSequenceHtml(tx.milestones, tx.custom_fields);

      // Overdue Callout HTML
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

      // Upcoming Milestone HTML
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
              <h3 style="margin: 0 0 4px 0; font-size: 17px; font-weight: 700; color: #f8fafc; font-family: 'Fraunces', Georgia, serif;">
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
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #131826; border: 1px solid #334155; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          
          <!-- Header Branding -->
          <tr>
            <td style="padding: 28px 24px 20px 24px; border-bottom: 1px solid #334155; background: linear-gradient(180deg, #1e293b 0%, #131826 100%);">
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #d97706; margin-bottom: 6px;">
                MSREG Marketing Hub
              </div>
              <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700; color: #f8fafc; font-family: 'Fraunces', Georgia, serif;">
                ${title}
              </h1>
              <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">
                Good morning, ${agentName}. ${subtitle}
              </p>
            </td>
          </tr>

          <!-- Summary Badges -->
          <tr>
            <td style="padding: 16px 24px 8px 24px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 12px; background-color: #1e293b; border: 1px solid #334155; border-radius: 10px; width: 48%; vertical-align: top;">
                    <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Active Escrows</div>
                    <div style="font-size: 22px; font-weight: 800; color: #38bdf8; margin-top: 4px; font-family: monospace;">${totalDeals}</div>
                  </td>
                  <td style="width: 4%;"></td>
                  <td style="padding: 12px; background-color: #1e293b; border: 1px solid #334155; border-radius: 10px; width: 48%; vertical-align: top;">
                    <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Action Required</div>
                    <div style="font-size: 22px; font-weight: 800; color: ${totalOverdueCount > 0 ? '#ef4444' : '#10b981'}; margin-top: 4px; font-family: monospace;">
                      ${totalOverdueCount} Overdue
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Transactions List -->
          <tr>
            <td style="padding: 16px 24px;">
              <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-bottom: 12px;">
                Current Active Files (${totalDeals})
              </div>
              ${transactionRowsHtml}
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 8px 24px 28px 24px; text-align: center;">
              <a href="${appBaseUrl}/my-deals" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #d97706 0%, #c86d3b 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.35); text-align: center;">
                Open My Deals Portal →
              </a>
              <div style="margin-top: 12px; font-size: 11px; color: #64748b;">
                Need assistance? Contact your assigned Transaction Coordinator.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 24px; background-color: #0f172a; border-top: 1px solid #334155; text-align: center; font-size: 11px; color: #64748b;">
              <div>MSREG Marketing & Transaction Management System</div>
              <div style="margin-top: 4px;">Sent automatically to ${agentEmail} as part of your scheduled escrow digest.</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  // Plain Text Fallback
  const text = `
${title.toUpperCase()}
Agent: ${agentName}
${subtitle}

Active Deals: ${totalDeals}
Overdue Items: ${totalOverdueCount}
==================================================

${transactions
  .map((tx, idx) => {
    let block = `${idx + 1}. ${tx.property_address} (${tx.side.toUpperCase()})\n`;
    block += `   Client: ${tx.client_name}\n`;
    if (tx.target_closing_date) {
      block += `   Target Close: ${tx.target_closing_date}\n`;
    }
    if (tx.milestones && tx.milestones.length > 0) {
      block += `   Milestones: ${tx.milestones.map((m) => `${m.milestone_type}: ${m.status}`).join(' | ')}\n`;
    }
    if (tx.next_milestone) {
      block += `   Next Milestone: ${tx.next_milestone.label} (Target: ${tx.next_milestone.target_date || 'TBD'})\n`;
    }
    if (tx.overdue_milestones && tx.overdue_milestones.length > 0) {
      block += `   ⚠️ OVERDUE ITEMS:\n`;
      tx.overdue_milestones.forEach((o) => {
        block += `      - ${o.label}: Target was ${o.target_date} (${o.days_overdue} days past due, status: ${o.status})\n`;
      });
    }
    return block;
  })
  .join('\n')}

==================================================
View and review your complete deal file on MSREG Hub:
${appBaseUrl}/my-deals
  `.trim();

  return { subject, html, text };
}
