/**
 * GET /api/load?userId=XXXX
 * Loads saved game state from Vercel KV.
 *
 * Returns: { ok, gameState? }
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ ok: false, error: 'Missing userId' });

  try {
    const { kv } = await import('@vercel/kv');
    const gameState = await kv.get(`state:${userId}`);
    if (gameState) {
      return res.status(200).json({ ok: true, gameState });
    }
    return res.status(200).json({ ok: true, gameState: null });
  } catch (e) {
    // KV not available
    return res.status(200).json({ ok: true, gameState: null });
  }
}
