/**
 * POST /api/register
 * Links a TON wallet address to a userId.
 * Called automatically when user connects wallet.
 *
 * Body: { userId, wallet, username? }
 * Returns: { ok }
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, wallet, username } = req.body || {};
  if (!userId || !wallet) return res.status(400).json({ ok: false, error: 'Missing fields' });

  try {
    const { kv } = await import('@vercel/kv');
    await kv.set(`wallet:${userId}`, wallet);
    await kv.set(`user_meta:${userId}`, JSON.stringify({ userId, wallet, username: username || null, registered: Date.now() }));
    console.log(`[register] userId=${userId} wallet=${wallet}`);
  } catch (e) {
    console.warn('[register] KV not available — dev mode');
  }

  return res.status(200).json({ ok: true });
}
