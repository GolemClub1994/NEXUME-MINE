/**
 * POST /api/sync — saves game state + leaderboard data
 * Accepts monthScore (v10) or monthEarned (older versions)
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, gameState, totalEarned, totalTaps, monthScore, monthEarned, monthClaimed, stakedV, wallet, name } = req.body || {};
  if (!userId) return res.status(400).json({ ok: false, error: 'Missing userId' });

  try {
    const { kv } = await import('@vercel/kv');
    if (gameState) await kv.set(`state:${userId}`, gameState);
    await kv.set(`user:${userId}`, JSON.stringify({
      totalEarned: Math.floor(totalEarned || 0),
      totalTaps: totalTaps || 0,
      monthEarned: Math.floor(monthScore || monthEarned || 0),
      monthClaimed: monthClaimed || false,
      stakedV: stakedV || 0,
      wallet: wallet || null,
      name: name || null,
      lastSync: Date.now()
    }));
  } catch (e) {
    console.warn('[sync] KV error:', e.message);
  }

  return res.status(200).json({ ok: true });
}
