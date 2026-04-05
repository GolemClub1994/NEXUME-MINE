/**
 * POST /api/claim — Real Jetton transfer
 * 96h cooldown, 10,000 pts = 1 real $NEXUS, min 100 real, max 500 real, 5% fee
 */
const CLAIM_CD = 345_600_000; // 96h
const CONV = 10_000;
const MIN_CLAIM_PTS = 1_000_000; // 100 real
const MAX_CLAIM_REAL = 500;
const DEV_FEE = 0.05;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, wallet, amount, totalTaps, totalEarned } = req.body || {};
  if (!userId || !wallet || !amount) return res.status(400).json({ success: false, error: 'Missing fields' });
  if (amount < MIN_CLAIM_PTS) return res.status(400).json({ success: false, error: `Need at least ${(MIN_CLAIM_PTS/CONV)} real $NEXUS (${MIN_CLAIM_PTS.toLocaleString()} pts)` });

  let realAmount = Math.floor(amount / CONV);
  if (realAmount > MAX_CLAIM_REAL) realAmount = MAX_CLAIM_REAL;
  const fee = Math.ceil(realAmount * DEV_FEE);
  const userGets = realAmount - fee;
  const deducted = Math.min(amount, realAmount * CONV);

  let kv = null, lastClaim = 0;
  try {
    const { kv: k } = await import('@vercel/kv');
    kv = k;
    const s = await kv.get(`claim:${userId}`);
    if (s) lastClaim = parseInt(s, 10);
  } catch (e) {}

  const now = Date.now();
  if (now - lastClaim < CLAIM_CD) {
    const rem = CLAIM_CD - (now - lastClaim);
    const h = Math.floor(rem/3600000), m = Math.floor((rem%3600000)/60000);
    return res.status(429).json({ success: false, error: `Next claim in ${h}h ${m}m`, remaining: rem });
  }

  let txHash = null;
  const MNEMONIC = process.env.TREASURY_MNEMONIC;
  const JETTON = process.env.JETTON_ADDRESS || 'EQBH_DOKvvJ7soxzf4QGPOvEuJR3IvM_jXvQfSRmfNaN86DU';

  if (MNEMONIC) {
    try {
      const { mnemonicToPrivateKey } = await import('@ton/crypto');
      const { TonClient, WalletContractV4, internal, toNano, Address, beginCell } = await import('@ton/ton');
      const client = new TonClient({ endpoint: 'https://toncenter.com/api/v2/jsonRPC', apiKey: process.env.TONCENTER_API_KEY || undefined });
      const kp = await mnemonicToPrivateKey(MNEMONIC.split(' '));
      const tw = WalletContractV4.create({ workchain: 0, publicKey: kp.publicKey });
      const c = client.open(tw);
      const seq = await c.getSeqno();
      const amt = BigInt(Math.floor(userGets * 1e9));
      const dest = Address.parse(wallet);
      const jm = Address.parse(JETTON);
      const r = await client.runMethod(jm, 'get_wallet_address', [{ type: 'slice', cell: beginCell().storeAddress(tw.address).endCell() }]);
      const jw = r.stack.readAddress();
      const body = beginCell().storeUint(0xf8a7ea5, 32).storeUint(0, 64).storeCoins(amt).storeAddress(dest).storeAddress(tw.address).storeBit(0).storeCoins(toNano('0.01')).storeBit(0).endCell();
      await c.sendTransfer({ seqno: seq, secretKey: kp.secretKey, messages: [internal({ to: jw, value: toNano('0.05'), body })] });
      txHash = 'tx_' + seq;
      console.log(`[claim] ${userGets} NEXUS → ${wallet}`);
    } catch (e) {
      console.error('[claim]', e.message);
      if (kv) await kv.lpush('claims:pending', JSON.stringify({ userId, wallet, userGets, ts: now, err: e.message }));
    }
  } else {
    if (kv) await kv.lpush('claims:pending', JSON.stringify({ userId, wallet, userGets, ts: now }));
  }

  if (kv) {
    await kv.set(`claim:${userId}`, String(now), { ex: 360000 });
    await kv.lpush('claims:log', JSON.stringify({ userId, wallet, realAmount, fee, userGets, txHash, ts: now }));
  }

  return res.status(200).json({
    success: true, deducted, onChainAmount: userGets, fee, txHash,
    message: txHash ? `✅ ${userGets} real $NEXUS sent to your wallet!` : '📡 Claim queued — tokens arriving soon'
  });
}
