// Demo Data Generator
// Creates synthetic fraud scenarios for demonstration

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { DemoScenario, FraudRingType } from '@/types/lunar-graph';
import { v4 as uuidv4 } from 'uuid';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    name: 'Opposite Trading Ring',
    description: '5 clients trading mirror positions to guarantee profits',
    type: 'opposite_trading',
    affiliates: 2,
    clients: 5,
    trades: 20,
  },
  {
    name: 'Multi-Account Abuse',
    description: 'Same device fingerprint across multiple accounts',
    type: 'multi_account',
    affiliates: 1,
    clients: 4,
    trades: 16,
  },
  {
    name: 'IP Clustering',
    description: 'Multiple accounts from same IP range',
    type: 'ip_clustering',
    affiliates: 1,
    clients: 6,
    trades: 12,
  },
  {
    name: 'Commission Pumping',
    description: 'High volume low-value trades for commission extraction',
    type: 'commission_pumping',
    affiliates: 1,
    clients: 3,
    trades: 50,
  },
];

const SYMBOLS = ['1HZ100V', '1HZ75V', '1HZ50V', 'BOOM1000', 'CRASH1000'];
const FINGERPRINTS = [
  'fp_abc123def456',
  'fp_xyz789uvw012',
  'fp_mno345pqr678',
  'fp_stu901vwx234',
];

function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateIP(base?: string): string {
  if (base) {
    const parts = base.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}.${Math.floor(Math.random() * 255)}`;
  }
  return `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

async function createDemoAffiliate(name: string): Promise<string> {
  const referralCode = generateReferralCode();
  const { data, error } = await db
    .from('affiliates')
    .insert({
      name,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@demo.com`,
      referral_code: referralCode,
    })
    .select()
    .single();

  if (error) throw error;
  return data.id;
}

async function createDemoClient(
  affiliateId: string,
  referralCode: string,
  options: {
    ip?: string;
    fingerprint?: string;
  } = {}
): Promise<string> {
  const { data, error } = await db
    .from('clients')
    .insert({
      affiliate_id: affiliateId,
      referral_code: referralCode,
      email: `client_${uuidv4().slice(0, 6)}@demo.com`,
      ip_address: options.ip || generateIP(),
      device_id: uuidv4().slice(0, 8),
    })
    .select()
    .single();

  if (error) throw error;

  // Create visitor tracking entry with fingerprint
  if (options.fingerprint) {
    await db.from('visitor_tracking').insert({
      visitor_id: uuidv4(),
      session_id: uuidv4(),
      referral_code: referralCode,
      event_type: 'pageview',
      page_url: '/trade',
      ip_address: options.ip || generateIP(),
      canvas_fingerprint: options.fingerprint,
      device_type: 'desktop',
      browser_name: 'Chrome',
      user_agent: 'Mozilla/5.0 Demo',
    });
  }

  return data.id;
}

async function createDemoTrade(
  clientId: string,
  affiliateId: string,
  options: {
    contractType: 'CALL' | 'PUT';
    amount: number;
    symbol: string;
    timestamp?: Date;
    profit?: number;
  }
): Promise<void> {
  const status = options.profit !== undefined ? (options.profit > 0 ? 'won' : 'lost') : 'open';

  await db.from('trades').insert({
    client_id: clientId,
    affiliate_id: affiliateId,
    contract_type: options.contractType,
    symbol: options.symbol,
    amount: options.amount,
    buy_price: options.amount,
    sell_price: options.profit !== undefined ? options.amount + options.profit : null,
    profit: options.profit,
    status,
    created_at: options.timestamp?.toISOString() || new Date().toISOString(),
  });
}

// ============ SCENARIO GENERATORS ============

async function generateOppositeTrading(): Promise<{ affiliates: number; clients: number; trades: number }> {
  console.log('[DemoGen] Creating Opposite Trading Ring...');

  // Create 2 affiliates
  const aff1 = await createDemoAffiliate('Fraud Affiliate A');
  const aff2 = await createDemoAffiliate('Fraud Affiliate B');

  // Get referral codes
  const { data: affData1 } = await db.from('affiliates').select('referral_code').eq('id', aff1).single();
  const { data: affData2 } = await db.from('affiliates').select('referral_code').eq('id', aff2).single();

  // Create clients - some with same IP to create connections
  const baseIP = '10.0.1.100';
  const clients: Array<{ id: string; affiliateId: string }> = [];

  for (let i = 0; i < 5; i++) {
    const affiliateId = i < 3 ? aff1 : aff2;
    const referralCode = i < 3 ? affData1.referral_code : affData2.referral_code;
    const clientId = await createDemoClient(affiliateId, referralCode, {
      ip: generateIP(baseIP),
    });
    clients.push({ id: clientId, affiliateId });
  }

  // Create opposite trades - pairs of CALL/PUT within seconds
  let tradeCount = 0;
  const now = new Date();

  for (let i = 0; i < 10; i++) {
    const symbol = SYMBOLS[i % SYMBOLS.length];
    const amount = 10 + Math.random() * 40;
    const baseTime = new Date(now.getTime() - i * 60000); // 1 minute apart

    // CALL trade from client A
    const clientA = clients[i % 3];
    await createDemoTrade(clientA.id, clientA.affiliateId, {
      contractType: 'CALL',
      amount,
      symbol,
      timestamp: baseTime,
      profit: Math.random() > 0.5 ? amount * 0.8 : -amount,
    });
    tradeCount++;

    // PUT trade from client B (opposite side, within 3 seconds)
    const clientB = clients[3 + (i % 2)];
    const offsetMs = Math.floor(Math.random() * 3000);
    await createDemoTrade(clientB.id, clientB.affiliateId, {
      contractType: 'PUT',
      amount: amount * (0.9 + Math.random() * 0.2), // Similar amount
      symbol,
      timestamp: new Date(baseTime.getTime() + offsetMs),
      profit: Math.random() > 0.5 ? amount * 0.8 : -amount,
    });
    tradeCount++;
  }

  return { affiliates: 2, clients: 5, trades: tradeCount };
}

async function generateMultiAccountAbuse(): Promise<{ affiliates: number; clients: number; trades: number }> {
  console.log('[DemoGen] Creating Multi-Account Abuse...');

  const aff = await createDemoAffiliate('Multi-Account Controller');
  const { data: affData } = await db.from('affiliates').select('referral_code').eq('id', aff).single();

  // All clients share same device fingerprint
  const sharedFingerprint = FINGERPRINTS[0];
  const clients: string[] = [];

  for (let i = 0; i < 4; i++) {
    const clientId = await createDemoClient(aff, affData.referral_code, {
      fingerprint: sharedFingerprint,
    });
    clients.push(clientId);
  }

  // Create trades from all accounts
  let tradeCount = 0;
  const now = new Date();

  for (let i = 0; i < 16; i++) {
    const clientId = clients[i % clients.length];
    await createDemoTrade(clientId, aff, {
      contractType: Math.random() > 0.5 ? 'CALL' : 'PUT',
      amount: 5 + Math.random() * 20,
      symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      timestamp: new Date(now.getTime() - i * 30000),
    });
    tradeCount++;
  }

  return { affiliates: 1, clients: 4, trades: tradeCount };
}

async function generateIPClustering(): Promise<{ affiliates: number; clients: number; trades: number }> {
  console.log('[DemoGen] Creating IP Clustering...');

  const aff = await createDemoAffiliate('IP Farm Controller');
  const { data: affData } = await db.from('affiliates').select('referral_code').eq('id', aff).single();

  // All clients from same IP range
  const baseIP = '172.16.0.1';
  const clients: string[] = [];

  for (let i = 0; i < 6; i++) {
    const clientId = await createDemoClient(aff, affData.referral_code, {
      ip: generateIP(baseIP),
      fingerprint: FINGERPRINTS[i % FINGERPRINTS.length], // Different devices but same IP range
    });
    clients.push(clientId);
  }

  // Create trades
  let tradeCount = 0;
  const now = new Date();

  for (let i = 0; i < 12; i++) {
    const clientId = clients[i % clients.length];
    await createDemoTrade(clientId, aff, {
      contractType: Math.random() > 0.5 ? 'CALL' : 'PUT',
      amount: 10 + Math.random() * 30,
      symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      timestamp: new Date(now.getTime() - i * 45000),
    });
    tradeCount++;
  }

  return { affiliates: 1, clients: 6, trades: tradeCount };
}

async function generateCommissionPumping(): Promise<{ affiliates: number; clients: number; trades: number }> {
  console.log('[DemoGen] Creating Commission Pumping...');

  const aff = await createDemoAffiliate('Commission Farmer');
  const { data: affData } = await db.from('affiliates').select('referral_code').eq('id', aff).single();

  const clients: string[] = [];
  for (let i = 0; i < 3; i++) {
    const clientId = await createDemoClient(aff, affData.referral_code, {});
    clients.push(clientId);
  }

  // Create many low-value trades (commission pumping)
  let tradeCount = 0;
  const now = new Date();

  for (let i = 0; i < 50; i++) {
    const clientId = clients[i % clients.length];
    await createDemoTrade(clientId, aff, {
      contractType: Math.random() > 0.5 ? 'CALL' : 'PUT',
      amount: 1 + Math.random() * 3, // Very low amounts
      symbol: SYMBOLS[0], // Same symbol
      timestamp: new Date(now.getTime() - i * 10000), // Rapid trading
      profit: Math.random() > 0.5 ? 0.5 : -1,
    });
    tradeCount++;
  }

  return { affiliates: 1, clients: 3, trades: tradeCount };
}

// ============ MAIN GENERATOR ============

export async function generateDemoData(
  scenarioType?: FraudRingType
): Promise<{
  scenario: DemoScenario;
  entitiesCreated: { affiliates: number; clients: number; trades: number };
}> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  let scenario: DemoScenario;
  let entitiesCreated: { affiliates: number; clients: number; trades: number };

  if (scenarioType) {
    scenario = DEMO_SCENARIOS.find(s => s.type === scenarioType) || DEMO_SCENARIOS[0];
  } else {
    // Pick random scenario
    scenario = DEMO_SCENARIOS[Math.floor(Math.random() * DEMO_SCENARIOS.length)];
  }

  console.log(`[DemoGen] Generating scenario: ${scenario.name}`);

  switch (scenario.type) {
    case 'opposite_trading':
      entitiesCreated = await generateOppositeTrading();
      break;
    case 'multi_account':
      entitiesCreated = await generateMultiAccountAbuse();
      break;
    case 'ip_clustering':
      entitiesCreated = await generateIPClustering();
      break;
    case 'commission_pumping':
      entitiesCreated = await generateCommissionPumping();
      break;
    default:
      entitiesCreated = await generateOppositeTrading();
  }

  console.log(`[DemoGen] Created ${entitiesCreated.affiliates} affiliates, ${entitiesCreated.clients} clients, ${entitiesCreated.trades} trades`);

  return { scenario, entitiesCreated };
}

export async function generateAllDemoScenarios(): Promise<void> {
  console.log('[DemoGen] Generating all demo scenarios...');

  for (const scenario of DEMO_SCENARIOS) {
    await generateDemoData(scenario.type);
  }

  console.log('[DemoGen] All scenarios generated');
}

export { DEMO_SCENARIOS };
