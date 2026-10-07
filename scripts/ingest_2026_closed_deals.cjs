const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env
const envPath = path.resolve(__dirname, '../.env');
const envText = fs.readFileSync(envPath, 'utf8');
const urlMatch = envText.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

if (!urlMatch || !keyMatch) {
  console.error('Missing Supabase configuration in .env');
  process.exit(1);
}

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const result = [];
  for (const line of lines) {
    const row = [];
    let inQuotes = false;
    let current = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    result.push(row);
  }
  return result;
}

function parseMoney(val) {
  if (val === null || val === undefined) return null;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

async function runIngestion() {
  console.log('--- Starting 2026 Sisu Closed Deals Ingestion ---');

  // 1. Fetch current agents
  const { data: dbAgents, error: agErr } = await supabase.from('agents').select('id, name, email');
  if (agErr) {
    console.error('Error fetching agents:', agErr);
    process.exit(1);
  }

  const agentMap = new Map();
  dbAgents.forEach(a => {
    agentMap.set(a.name.toLowerCase().trim(), a.id);
  });

  // Aliases
  if (agentMap.has('mike odle')) {
    agentMap.set('michael odle', agentMap.get('mike odle'));
  }

  // Read CSV
  const csvPath = path.resolve(__dirname, '../supabase/seed_data/sisu_2026_transactions.csv');
  const csvText = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(csvText);
  const headers = rows[0].map(h => h.replace(/^"|"$/g, '').trim());

  const getIdx = (col) => headers.indexOf(col);
  const idCol = getIdx('ID');
  const agentCol = getIdx('Agent');
  const statusCol = getIdx('Status');
  const typeCol = getIdx('Transaction Type');
  const firstCol = getIdx('First Name');
  const lastCol = getIdx('Last Name');
  const emailCol = getIdx('Contact Email');
  const phoneCol = getIdx('Mobile Phone Number');
  const addrCol = getIdx('Address Line 1');
  const cityCol = getIdx('City');
  const zipCol = getIdx('Postal Code');
  const closedCol = getIdx('Closed (Settlement) Date');
  const incomeCol = getIdx('Gross Agent(s) Paid Income');
  const gciCol = getIdx('GCI');
  const amountCol = getIdx('Transaction Amount');
  const commCol = getIdx('Commission Rate');
  const ucCol = getIdx('Under Contract Date');
  const forecastCol = getIdx('Forecasted Closed Date');
  const coopNameCol = getIdx('Cooperating Agent Name');
  const coopEmailCol = getIdx('Cooperating Agent Email');
  const coopPhoneCol = getIdx('Cooperating Agent Phone');
  const titleCol = getIdx('Title Company');

  const KATIE_AGENTS = [
    'amy reid', 'britney rembold', 'erik kean', 'jenette richardson', 
    'joseph bahr', 'josh chapman', 'joshua kiehne', 'luis padilla aparicio', 
    'marissa beatty', 'michael odle', 'mike odle', 'robert montenegro', 'ryan reagan', 
    'sebastian rush', 'shawn mcarthur', 'shawn witzemann'
  ];

  // Identify any agents that need insertion
  const missingAgents = new Set();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const status = (r[statusCol] || '').replace(/^"|"$/g, '').trim();
    const closedDt = (r[closedCol] || '').replace(/^"|"$/g, '').trim();
    const agent = (r[agentCol] || '').replace(/^"|"$/g, '').trim();
    if (status.toLowerCase() === 'closed' && closedDt.startsWith('2026-')) {
      const norm = agent.toLowerCase().trim();
      if (!agentMap.has(norm) && norm) {
        missingAgents.add(agent);
      }
    }
  }

  for (const agName of missingAgents) {
    const email = `${agName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@mattsmithrealestategroup.com`;
    console.log(`Inserting missing agent: ${agName} (${email})`);
    const { data: newAg, error: insErr } = await supabase.from('agents').insert({
      name: agName,
      email,
      active: true,
      category: 'Agent',
      role: 'agent'
    }).select('id').maybeSingle();
    if (newAg) {
      agentMap.set(agName.toLowerCase().trim(), newAg.id);
    } else {
      console.warn('Could not insert agent:', insErr);
    }
  }

  // Filter 2026 closed deals
  const dealsToUpsert = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const sisuId = (r[idCol] || '').replace(/^"|"$/g, '').trim();
    const status = (r[statusCol] || '').replace(/^"|"$/g, '').trim();
    const closedDt = (r[closedCol] || '').replace(/^"|"$/g, '').trim();
    const agent = (r[agentCol] || '').replace(/^"|"$/g, '').trim();
    const addr = (r[addrCol] || '').replace(/^"|"$/g, '').trim();

    if (status.toLowerCase() === 'closed' && closedDt.startsWith('2026-')) {
      if (!addr || addr.length < 3) continue;

      const normAgent = agent.toLowerCase().trim();
      const agentId = agentMap.get(normAgent) || null;

      const sideRaw = (r[typeCol] || '').toLowerCase();
      const side = (sideRaw.includes('seller') || sideRaw.includes('listing')) ? 'seller' : 'buyer';

      const firstName = (r[firstCol] || '').replace(/^"|"$/g, '').trim();
      const lastName = (r[lastCol] || '').replace(/^"|"$/g, '').trim();
      const clientName = `${firstName} ${lastName}`.trim() || 'Client';

      const grossIncome = parseMoney(r[incomeCol]);
      const gci = parseMoney(r[gciCol]);
      const price = parseMoney(r[amountCol]);
      const commRate = parseMoney(r[commCol]);

      const assignedTcId = KATIE_AGENTS.some(a => normAgent.includes(a))
        ? '5580daa6-415d-4385-986a-69bc94421c0c'
        : 'f4436dcc-4d52-4a26-af80-05096b76067e';

      dealsToUpsert.push({
        sisu_transaction_id: sisuId,
        status: 'Closed',
        property_address: addr,
        city: (r[cityCol] || '').replace(/^"|"$/g, '').trim() || 'Waynesville',
        state: 'MO',
        zip: (r[zipCol] || '').replace(/^"|"$/g, '').trim() || '65583',
        side,
        client_name: clientName,
        client_email: (r[emailCol] || '').replace(/^"|"$/g, '').trim() || null,
        client_phone: (r[phoneCol] || '').replace(/^"|"$/g, '').trim() || null,
        listing_agent_id: side === 'seller' ? agentId : null,
        selling_agent_id: side === 'buyer' ? agentId : null,
        assigned_tc_id: assignedTcId,
        contract_date: (r[ucCol] || '').slice(0, 10) || null,
        target_closing_date: (r[forecastCol] || '').slice(0, 10) || closedDt.slice(0, 10) || null,
        price,
        other_party_agent: (r[coopNameCol] || '').replace(/^"|"$/g, '').trim() || null,
        other_party_email: (r[coopEmailCol] || '').replace(/^"|"$/g, '').trim() || null,
        other_party_phone: (r[coopPhoneCol] || '').replace(/^"|"$/g, '').trim() || null,
        title_company: (r[titleCol] || '').replace(/^"|"$/g, '').trim() || null,
        custom_fields: {
          gross_agent_paid_income: grossIncome,
          gci,
          price,
          commission_rate: commRate,
          closed_date: closedDt.slice(0, 10),
        }
      });
    }
  }

  console.log(`Found ${dealsToUpsert.length} 2026 closed deals to upsert.`);

  // Batch upsert in chunks of 25
  const chunkSize = 25;
  let successCount = 0;

  for (let i = 0; i < dealsToUpsert.length; i += chunkSize) {
    const chunk = dealsToUpsert.slice(i, i + chunkSize);
    const { error: upsertErr } = await supabase.from('transactions').upsert(chunk, {
      onConflict: 'sisu_transaction_id'
    });

    if (upsertErr) {
      console.error(`Error upserting chunk ${i / chunkSize}:`, upsertErr);
    } else {
      successCount += chunk.length;
      process.stdout.write(`Processed ${successCount}/${dealsToUpsert.length} deals...\r`);
    }
  }

  console.log(`\n Successfully ingested ${successCount} 2026 closed deals into Supabase!`);
}

runIngestion();
