import { supabase } from '../integrations/supabase/client';

export interface GoogleRosterAgent {
  name: string;
  email: string;
  phone?: string;
  role: string;
  category: 'Operations' | 'Buyer Specialist' | 'Listing Specialist' | 'Hybrid Agent' | 'Owner' | 'General';
}

export const GOOGLE_ROSTER_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/17IMhaysKij8mhbceituxv5fcxfOfsKxBm2Qr0CrOwDE/gviz/tq?tqx=out:csv&sheet=full%20office%20roster';

/**
 * Fetch and parse the live agent roster from the Google Sheet
 */
export async function fetchGoogleSheetRoster(): Promise<GoogleRosterAgent[]> {
  const response = await fetch(GOOGLE_ROSTER_SHEET_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Google Sheet: ${response.statusText}`);
  }
  const text = await response.text();

  // CSV parser accounting for quotes and embedded newlines
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentVal.trim());
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  if (currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    rows.push(currentRow);
  }

  const agents: GoogleRosterAgent[] = [];
  let currentCategory: GoogleRosterAgent['category'] = 'General';

  for (const row of rows) {
    const firstNonEmpty = row.find((c) => c.trim().length > 0);
    if (!firstNonEmpty) continue;

    const joined = row.join(' ');
    if (joined.includes('Operations:')) {
      currentCategory = 'Operations';
      continue;
    } else if (joined.includes('Buyers Specialists:')) {
      currentCategory = 'Buyer Specialist';
      continue;
    } else if (joined.includes('Listing Specialists:')) {
      currentCategory = 'Listing Specialist';
      continue;
    } else if (joined.includes('Hybrid Agents')) {
      currentCategory = 'Hybrid Agent';
      continue;
    } else if (joined.includes('Owners:')) {
      currentCategory = 'Owner';
      continue;
    } else if (joined.includes('Integrity Property Management')) {
      continue; // Skip external property management company rows
    }

    const emailIndex = row.findIndex((c) => c.includes('@'));
    if (emailIndex !== -1) {
      let rawEmail = row[emailIndex].replace(/[\r\n\s]+/g, '').trim().toLowerCase();
      if (rawEmail.endsWith('@mattsmithrealestategroupcom')) {
        rawEmail = rawEmail.replace('@mattsmithrealestategroupcom', '@mattsmithrealestategroup.com');
      }

      let name = row[1] ? row[1].replace(/\*/g, '').replace(/^"+|"+$/g, '').trim() : '';
      let role = row[2] ? row[2].trim() : currentCategory;
      let phone = row[emailIndex + 1] ? row[emailIndex + 1].replace(/\*/g, '').trim() : '';

      if (name.includes('Mike') && name.includes('Odle')) {
        name = 'Mike Odle';
      }

      if (name && rawEmail.includes('@')) {
        agents.push({
          name,
          email: rawEmail,
          phone: phone || undefined,
          role,
          category: currentCategory,
        });
      }
    }
  }

  // Deduplicate by lowercase email, merging roles if person is on both sides
  const uniqueMap = new Map<string, GoogleRosterAgent>();
  for (const a of agents) {
    const key = a.email.toLowerCase();
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, a);
    } else {
      const existing = uniqueMap.get(key)!;
      if (existing.role !== a.role && !existing.role.includes(a.role)) {
        existing.role = `${existing.role} / ${a.role}`;
      }
    }
  }

  return Array.from(uniqueMap.values());
}

/**
 * Synchronize the Google Sheet roster into Supabase agents table and update transactions
 */
export async function syncGoogleRosterToSupabase(): Promise<{
  updated: number;
  inserted: number;
  transactionsUpdated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let updated = 0;
  let inserted = 0;
  let transactionsUpdated = 0;

  try {
    const roster = await fetchGoogleSheetRoster();

    // Fetch existing agents
    const { data: dbAgents, error: agentFetchErr } = await (supabase.from('agents') as any).select('*');
    if (agentFetchErr) {
      throw new Error(`Error fetching agents: ${agentFetchErr.message}`);
    }

    const existingAgents = dbAgents || [];

    for (const rAgent of roster) {
      const rEmail = rAgent.email.toLowerCase();
      const rNameClean = rAgent.name.toLowerCase().replace(/[^a-z]/g, '');

      // Find match
      const matched = existingAgents.find((a: any) => {
        const aEmail = (a.email || '').toLowerCase();
        const aNameClean = (a.name || '').toLowerCase().replace(/[^a-z]/g, '');
        return aEmail === rEmail || aNameClean === rNameClean;
      });

      if (!matched) {
        // Insert new agent
        const { error: insErr } = await (supabase.from('agents') as any).insert({
          name: rAgent.name,
          email: rAgent.email,
          phone: rAgent.phone || null,
          active: true,
        });
        if (insErr) {
          errors.push(`Failed to insert ${rAgent.name}: ${insErr.message}`);
        } else {
          inserted++;
        }
      } else {
        // Update existing agent
        const { error: updErr } = await (supabase.from('agents') as any)
          .update({
            name: rAgent.name,
            email: rAgent.email,
            phone: rAgent.phone || matched.phone,
            active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', matched.id);

        if (updErr) {
          errors.push(`Failed to update ${rAgent.name}: ${updErr.message}`);
        } else {
          updated++;
        }
      }
    }

    // Refresh updated agents from DB to sync transactions
    const { data: refreshedAgents } = await (supabase.from('agents') as any).select('*');
    if (refreshedAgents) {
      const agentMapByName = new Map<string, any>();
      const agentMapById = new Map<string, any>();
      refreshedAgents.forEach((a: any) => {
        agentMapById.set(a.id, a);
        agentMapByName.set(a.name.toLowerCase().replace(/[^a-z]/g, ''), a);
      });

      const { data: txs } = await (supabase.from('transactions') as any)
        .select('id, agent_name, agent_email, listing_agent_id, selling_agent_id')
        .not('status', 'in', '("closed","terminated")');

      if (txs) {
        for (const tx of txs) {
          let agentMatch = null;
          if (tx.listing_agent_id && agentMapById.has(tx.listing_agent_id)) {
            agentMatch = agentMapById.get(tx.listing_agent_id);
          } else if (tx.selling_agent_id && agentMapById.has(tx.selling_agent_id)) {
            agentMatch = agentMapById.get(tx.selling_agent_id);
          } else if (tx.agent_name) {
            const clean = tx.agent_name.toLowerCase().replace(/[^a-z]/g, '');
            agentMatch = agentMapByName.get(clean);
          }

          if (agentMatch && agentMatch.email && tx.agent_email !== agentMatch.email) {
            await (supabase.from('transactions') as any)
              .update({
                agent_email: agentMatch.email,
                agent_name: agentMatch.name,
              })
              .eq('id', tx.id);
            transactionsUpdated++;
          }
        }
      }
    }
  } catch (err: any) {
    errors.push(err.message || 'Unknown error occurred during sync');
  }

  return { updated, inserted, transactionsUpdated, errors };
}
