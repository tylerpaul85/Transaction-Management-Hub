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
  'inspection_notice_sent',
  'inspection_10day',
  'financing_contingency',
  'appraisal_received',
  'appraisal_satisfied',
  'title',
  'cds_obtained',
  'ctc',
  'closing_scheduled',
  'walk_through',
  'insurance_binder',
]);

export function getMilestoneLabels(side?: 'buyer' | 'seller'): Record<string, string> {
  const isSeller = side === 'seller';
  return {
    earnest_money: 'Earnest Money Deposited',
    inspection_ordered: 'Inspection Ordered',
    inspection_notice_sent: isSeller
      ? 'Inspection Notice Received? - Listing'
      : 'Inspection Notice Sent? - Buyer',
    inspection_10day: 'Inspection Satisfied',
    financing_contingency: 'Financing / Loan Commitment',
    appraisal_received: 'Appraisal Received',
    appraisal_satisfied: 'Appraisal Satisfied',
    insurance_binder: 'Insurance Binder Obtained',
    title: 'Title Commitment & Clearance',
    cds_obtained: 'Closing Disclosures (CDs) Obtained',
    ctc: 'Clear-to-Close (CTC)',
    closing_scheduled: 'Closing Scheduled',
    walk_through: 'Final Walkthrough',
  };
}

export const MILESTONE_LABELS = getMilestoneLabels('buyer');

export function getMilestoneOrderSequence(side?: 'buyer' | 'seller') {
  const isSeller = side === 'seller';
  return [
    { key: 'earnest_money', shortLabel: 'Earnest Money', label: 'Earnest Money Deposited' },
    { key: 'inspection_ordered', shortLabel: 'Inspection Ordered', label: 'Inspection Ordered' },
    {
      key: 'inspection_notice_sent',
      shortLabel: isSeller ? 'Notice Received' : 'Notice Sent',
      label: isSeller ? 'Inspection Notice Received? - Listing' : 'Inspection Notice Sent? - Buyer',
    },
    { key: 'inspection_10day', shortLabel: 'Inspection Satisfied', label: 'Inspection Satisfied' },
    { key: 'appraisal_received', shortLabel: 'Appraisal Received', label: 'Appraisal Received' },
    { key: 'financing_contingency', shortLabel: 'Financing', label: 'Financing / Loan Commitment' },
    { key: 'appraisal_satisfied', shortLabel: 'Appraisal Satisfied', label: 'Appraisal Satisfied' },
    { key: 'title', shortLabel: 'Title', label: 'Title Commitment & Clearance' },
    { key: 'cds_obtained', shortLabel: 'CDs Obtained', label: 'Closing Disclosures Obtained' },
    { key: 'ctc', shortLabel: 'Clear to Close', label: 'Clear to Close' },
    { key: 'closing_scheduled', shortLabel: 'Closing Scheduled', label: 'Closing Scheduled' },
    { key: 'walk_through', shortLabel: 'Walkthrough', label: 'Final Walkthrough' },
  ];
}

export const MILESTONE_ORDER_SEQUENCE = getMilestoneOrderSequence('buyer');

export function getFieldStatus(
  mType: string,
  milestones?: Array<{ milestone_type: string; status: string }>,
  customFields?: Record<string, any> | null
): 'complete' | 'in_progress' | 'na' | 'pending' {
  const list = milestones || [];
  const found = list.find((m) => m.milestone_type === mType);
  if (found && found.status) {
    const s = found.status.toLowerCase().trim();
    if (s === 'complete' || s === 'satisfied') return 'complete';
    if (s === 'in_progress') return 'in_progress';
    if (s === 'na' || s === 'waived') return 'na';
    if (s === 'pending') return 'pending';
  }

  if (customFields && typeof customFields === 'object') {
    const cfMap: Record<string, string[]> = {
      earnest_money: ['earnest_money_depositeds_63', 'earnest_money_deposited', 'earnest_money_deposited?_(internal_use)'],
      inspection_ordered: ['inspection_completeds_63', 'inspection_completed', 'inspection_ordred?_-_internal_use', 'inspection_ordered?_-_internal_use', 'inspection_ordered'],
      inspection_notice_sent: [
        'inspection_notice_sent?_-_internal',
        'inspection_notice_sent',
        'inspection_notice_received?_-_listing',
        'inspection_notice_received',
        'inspection_notice_received_listing',
        'inspection_notice_received?_-_internal_use',
        'inspection_notice_sent?_-_buyer',
        'inspection_notice_sent?_-_internal_use',
      ],
      inspection_10day: ['inspection_satisfieds_63', 'inspection_satisfied', 'inspection_satisfied?_-_internal_use'],
      financing_contingency: [
        'financing_/_loan_commitment_-_internal_use',
        'financing_loan_commitment_internal_use',
        'financing_loan_commitment',
        'financing_/_loan_commitment_(internal_use)',
      ],
      appraisal_received: ['appraisal_received', 'appraisal_received_internal_use', 'appraisal_received_(internal_use)'],
      appraisal_satisfied: ['appraisal_satisfied', 'appraisal_satisfied_internal_use', 'appraisal_satisfied_(internal_use)'],
      insurance_binder: ['insurance_obtaineds_63', 'insurance_obtained', 'insurance_obtained_internal_use'],
      title: ['title_commitment_s_38_clearance', 'title_commitment_clearance_internal_use', 'title_commitment', 'title_commitment_&_clearance_-_internal_use'],
      cds_obtained: ['cds_obtained_-_internal', 'cds_obtained'],
      ctc: ['clear-to-close_(ctc)', 'clear_to_close_internal_use', 'clear-to-close', 'clear_to_close', 'clear-to-close_(internal_use)'],
      closing_scheduled: ['closing_scheduled_-_internal_use', 'closing_scheduled'],
      walk_through: ['final_walkthrough', 'final_walkthrough_internal_use', 'final_walkthrough_(internal_use)'],
    };

    const keys = cfMap[mType] || [];
    for (const k of keys) {
      if (k in customFields) {
        const v = customFields[k];
        const str = String(v).trim().toLowerCase();
        if (str === '0' || str === 'yes' || str === 'true' || str === 'complete' || str === 'satisfied' || v === true) {
          return 'complete';
        }
        if (str === '2' || str === 'in progress' || str === 'in_progress') {
          return 'in_progress';
        }
        if (str === '3' || str === 'n/a' || str === 'na' || str === 'waived') {
          return 'na';
        }
        if (str === '1' || str === 'no' || str === 'false' || v === false) {
          return 'pending';
        }
      }
    }
  }

  return 'pending';
}

export function isFieldComplete(
  mType: string,
  milestones?: Array<{ milestone_type: string; status: string }>,
  customFields?: Record<string, any> | null
): boolean {
  return getFieldStatus(mType, milestones, customFields) === 'complete';
}

export function renderMilestoneSequenceHtml(
  milestones?: Array<{ milestone_type: string; status: string }>,
  customFields?: Record<string, any> | null,
  side?: 'buyer' | 'seller'
): string {
  const list = (milestones || []).filter((m) => ACTIVE_MILESTONES_SET.has(m.milestone_type));
  const sequence = getMilestoneOrderSequence(side);

  const pillsHtml = sequence.map((item, idx) => {
    let status: 'complete' | 'in_progress' | 'na' | 'pending' = 'pending';
    let isHalf = false;

    if ((item as any).subKeys && (item as any).subKeys.length > 0) {
      const statuses = (item as any).subKeys.map((sk: string) => getFieldStatus(sk, list, customFields));
      const nonNa = statuses.filter((s: string) => s !== 'na');

      if (nonNa.length === 0) {
        status = 'na';
      } else if (nonNa.every((s: string) => s === 'complete')) {
        status = 'complete';
      } else if (nonNa.some((s: string) => s === 'complete' || s === 'in_progress')) {
        status = 'in_progress';
        isHalf = true;
      } else {
        status = 'pending';
      }
    } else {
      status = getFieldStatus(item.key, list, customFields);
    }

    let bg = '#1e293b';
    let text = '#fcd34d';
    let border = '#d97706';
    let textDecoration = 'none';
    let opacity = '1.0';

    if (status === 'complete') {
      bg = '#064e3b';
      text = '#6ee7b7';
      border = '#059669';
    } else if (status === 'in_progress') {
      bg = '#0c4a6e';
      text = '#7dd3fc';
      border = '#0284c7';
    } else if (status === 'na') {
      bg = '#1e293b';
      text = '#64748b';
      border = '#334155';
      textDecoration = 'line-through';
      opacity = '0.65';
    }

    const pill = `<span style="display: inline-block; margin: 2px 1px; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 700; background-color: ${bg}; color: ${text}; border: 1px solid ${border}; text-decoration: ${textDecoration}; opacity: ${opacity}; vertical-align: middle; white-space: nowrap;">${item.shortLabel}${isHalf ? ' <span style="font-size: 9px; opacity: 0.9;">½</span>' : ''}</span>`;

    const connector =
      idx < sequence.length - 1
        ? `<span style="display: inline-block; width: 4px; height: 1.5px; background-color: #334155; vertical-align: middle; margin: 0 1px;"></span>`
        : '';

    return pill + connector;
  }).join('');

  return `
    <div style="margin-top: 12px; padding: 10px 12px; background-color: #141c2e; border: 1px solid #293548; border-radius: 10px;">
      <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;">
        ESCROW MILESTONE PROGRESS:
      </div>
      <div style="line-height: 1.8; overflow-x: auto;">
        ${pillsHtml}
      </div>
      <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #1e293b; font-size: 9.5px; color: #94a3b8; line-height: 1.4;">
        <span style="color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-right: 4px;">Milestone Key:</span>
        <span style="display: inline-block; margin-right: 8px;"><span style="color: #34d399; font-weight: bold;">●</span> Done</span>
        <span style="display: inline-block; margin-right: 8px;"><span style="color: #38bdf8; font-weight: bold;">●</span> In Progress</span>
        <span style="display: inline-block; margin-right: 8px;"><span style="color: #fbbf24; font-weight: bold;">●</span> Upcoming / Open</span>
        <span style="display: inline-block;"><span style="color: #64748b; font-weight: bold;">●</span> N/A</span>
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

      const milestoneSeqHtml = renderMilestoneSequenceHtml(tx.milestones, tx.custom_fields, tx.side as any);

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

          <!-- Milestone Status Guide -->
          <tr>
            <td style="padding: 0 24px 8px 24px;">
              <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 8px 12px; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                <span style="color: #f8fafc; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; margin-right: 6px;">Status Guide:</span>
                <span style="display: inline-block; margin-right: 8px;"><span style="color: #34d399; font-weight: bold;">●</span> <strong>Green:</strong> Done</span>
                <span style="display: inline-block; margin-right: 8px;"><span style="color: #38bdf8; font-weight: bold;">●</span> <strong>Blue:</strong> In Progress</span>
                <span style="display: inline-block; margin-right: 8px;"><span style="color: #fbbf24; font-weight: bold;">●</span> <strong>Orange:</strong> Upcoming (Not Due Yet)</span>
                <span style="display: inline-block;"><span style="color: #64748b; font-weight: bold;">●</span> <strong>Grey:</strong> N/A</span>
              </div>
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
