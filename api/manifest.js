/**
 * GET /api/manifest
 * Serves TON Connect manifest dynamically — always uses the real domain.
 * This fixes the "Failed to load Manifest: 404" error permanently.
 */
export default function handler(req, res) {
  // Use the real request host — works on ANY Vercel domain automatically
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'nexusmine.vercel.app';
  const proto = host.includes('localhost') ? 'http' : 'https';
  const base = `${proto}://${host}`;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=60');
  if (req.method === 'OPTIONS') return res.status(200).end();

  res.status(200).json({
    url: base,
    name: 'NEXUS MINE',
    iconUrl: `${base}/icon-192.png`
  });
}
