/**
 * POST /api/stake — Track staking deposits & yield
 *
 * Actions:
 *   deposit  — record a new stake deposit (5% fee auto-applied client-side)
 *   withdraw — record unstake
 *   yield    — record yield claim
 *
 * Body: { userId, action, amount, wallet? }
 */
const STAKE_MONTHLY_RATE = 0.03;  // 3%

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { userId, action, amount, wallet } = req.body || {};
  if (!userId || !action)
    return res.status(400).json({ ok: false, error: 'Missing fields' });

  try {
    const { kv } = await import('@vercel/kv');

    const key = `stake:${userId}`;
    let record = null;
    try {
      const raw = await kv.get(key);
      record = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
    } catch(e) {}

    if (!record) {
      record = { stakedPts:0, pendingYield:0, totalYieldClaimed:0, lastTS:Date.now(), wallet:wallet||null };
    }

    const now = Date.now();

    if (action === 'deposit' && amount > 0) {
      record.stakedPts  += amount;
      record.lastTS      = now;
      record.wallet      = wallet || record.wallet;

      // Log to admin list
      await kv.lpush('stakes:log', JSON.stringify({ userId, action:'deposit', amount, ts:now }));
    }

    if (action === 'withdraw') {
      record.stakedPts = 0;
      await kv.lpush('stakes:log', JSON.stringify({ userId, action:'withdraw', ts:now }));
    }

    if (action === 'yield' && amount > 0) {
      record.totalYieldClaimed += amount;
      record.pendingYield       = 0;
      await kv.lpush('stakes:log', JSON.stringify({ userId, action:'yield_claim', amount, ts:now }));
    }

    await kv.set(key, JSON.stringify(record));

    return res.status(200).json({
      ok: true,
      stakedPts: record.stakedPts,
      pendingYield: record.pendingYield,
      totalYieldClaimed: record.totalYieldClaimed,
      monthlyRate: STAKE_MONTHLY_RATE
    });
  } catch (e) {
    // KV unavailable — return ok for dev
    return res.status(200).json({ ok: true });
  }
}
