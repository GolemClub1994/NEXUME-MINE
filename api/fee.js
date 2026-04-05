/**
 * POST /api/fee
 * Silently tracks 5% platform fees.
 * Called internally for: claim, boost purchase, world unlock, staking deposit.
 *
 * Body: { userId, action, baseAmount, fee, ts, wallet? }
 */
const PLATFORM_FEE_RATE = 0.05;
const DEV_WALLET = 'UQAOsFEKdjnYUO133YkeHsuPJc_HTjaaR6pdeVcekh1Tv8Bz';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { userId, action, baseAmount, fee, ts, wallet } = req.body || {};
  if (!userId || !action || fee == null)
    return res.status(400).json({ ok: false, error: 'Missing fields' });

  try {
    const { kv } = await import('@vercel/kv');

    // Cumulative platform fee counter
    const cur = parseInt(await kv.get('platform:totalFees') || '0', 10);
    await kv.set('platform:totalFees', String(cur + (fee||0)));

    // Per-event log
    await kv.lpush('platform:fees:log', JSON.stringify({
      userId, action, baseAmount, fee,
      ts: ts || Date.now(),
      wallet: wallet || null,
      devWallet: DEV_WALLET
    }));

    // Per-user cumulative
    const userFees = parseInt(await kv.get(`fees:${userId}`) || '0', 10);
    await kv.set(`fees:${userId}`, String(userFees + (fee||0)));

  } catch (e) {
    // KV unavailable — dev mode
  }

  return res.status(200).json({ ok: true });
}
