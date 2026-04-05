/**
 * GET /api/manifest
 * Serves TonConnect manifest dynamically — always correct domain, no hardcoding.
 */
export default function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const proto = host.includes('localhost') ? 'http' : 'https';
  const base = `${proto}://${host}`;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=60');

  if (req.method === 'OPTIONS') return res.status(200).end();

  return res.status(200).json({
    url: base,
    name: 'NEXUS MINE',
    iconUrl: `${base}/icon-192.png`
  });
}
