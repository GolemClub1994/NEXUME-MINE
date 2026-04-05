/**
 * POST /api/sync — persists game state + leaderboard data
 *
 * Body: { userId, gameState, totalEarned, totalTaps,
 *         monthScore, monthClaimed, stakedV, wallet, name }
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const {
    userId, gameState, totalEarned, totalTaps,
    monthScore, monthClaimed, stakedV, wallet, name
  } = req.body || {};

  if (!userId) return res.status(400).json({ ok: false, error: 'Missing userId' });

  try {
    const { kv } = await import('@vercel/kv');

    // Full encrypted state for cross-device restore
    if (gameState) await kv.set(`state:${userId}`, gameState);

    // Check server-side leaderboard disqualification flag
    const serverMClm = await kv.get(`mclm:${userId}`);
    const effectiveMClm = monthClaimed || !!serverMClm;

    // Leaderboard summary
    await kv.set(`user:${userId}`, JSON.stringify({
      totalEarned:   Math.floor(totalEarned  || 0),
      totalTaps:     totalTaps || 0,
      monthScore:    Math.floor(monthScore   || 0),
      monthClaimed:  effectiveMClm,
      stakedV:       Math.floor(stakedV      || 0),
      wallet:        wallet || null,
      name:          name   || null,
      lastSync:      Date.now()
    }));
  } catch (e) {
    // KV not configured — dev mode, continue silently
  }

  return res.status(200).json({ ok: true });
}
