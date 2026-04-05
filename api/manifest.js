/**
 * GET /api/manifest
 * Serves TON Connect manifest as JSON.
 * Fixes 404 issue with static file routing on Vercel.
 */
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).json({
    url: 'https://neuxmeminegamingnew.vercel.app',
    name: 'NEXUS MINE',
    iconUrl: 'https://neuxmeminegamingnew.vercel.app/icon-192.png'
  });
}
