/**
 * GET /api/leaderboard
 * Returns top 30 players who haven't claimed this month.
 * Data comes from /api/sync which stores monthEarned and monthClaimed.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { kv } = await import('@vercel/kv');
    // Get all user keys
    const keys = await kv.keys('user:*');
    const players = [];
    for (const key of keys.slice(0, 200)) {
      try {
        const raw = await kv.get(key);
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (data && !data.monthClaimed && data.monthEarned > 0) {
          players.push({
            userId: key.replace('user:', ''),
            name: data.name || 'Miner',
            score: data.monthEarned || 0,
            totalTaps: data.totalTaps || 0
          });
        }
      } catch (e) {}
    }
    players.sort((a, b) => b.score - a.score);
    return res.status(200).json({ ok: true, players: players.slice(0, 30) });
  } catch (e) {
    return res.status(200).json({ ok: true, players: [] });
  }
}
