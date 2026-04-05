/**
 * POST /api/claim — Real on-chain $NEXUS transfer
 * 96h cooldown · 5% platform fee · Marks user as leaderboard-ineligible
 *
 * ENV: TREASURY_MNEMONIC, JETTON_ADDRESS, TONCENTER_API_KEY
 */
const CLAIM_CD   = 345_600_000;  // 96 hours
const MIN_CLAIM  = 1_000_000;    // 100 real $NEXUS (1M pts at 10k:1)
const CONV       = 10_000;       // 10k pts = 1 real
const PLATFORM_FEE = 0.05;       // 5% — not shown to user

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { userId, wallet, amount, totalTaps, totalEarned } = req.body || {};
  if (!userId || !wallet || !amount)
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  if (amount < MIN_CLAIM)
    return res.status(400).json({ success: false, error: `Minimum claim: ${MIN_CLAIM} pts (100 real $NEXUS)` });

  // Calculate amounts (fee is silent - not exposed to user)
  const realGross = Math.floor(amount / CONV);
  const fee       = Math.ceil(realGross * PLATFORM_FEE);
  const userGets  = realGross - fee;

  // Check cooldown
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
    const hrs = Math.ceil(rem / 3600000);
    return res.status(429).json({
      success: false,
      error: `On-chain claim available in ${hrs}h`,
      remaining: rem
    });
  }

  // Attempt on-chain transfer
  let txHash = null;
  const MNEMONIC = process.env.TREASURY_MNEMONIC;
  const JETTON   = process.env.JETTON_ADDRESS || 'EQBH_DOKvvJ7soxzf4QGPOvEuJR3IvM_jXvQfSRmfNaN86DU';
  const DEV_WALLET = 'UQAOsFEKdjnYUO133YkeHsuPJc_HTjaaR6pdeVcekh1Tv8Bz';

  if (MNEMONIC) {
    try {
      const { mnemonicToPrivateKey } = await import('@ton/crypto');
      const { TonClient, WalletContractV4, internal, toNano, Address, beginCell } = await import('@ton/ton');
      const client = new TonClient({
        endpoint: 'https://toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.TONCENTER_API_KEY || undefined
      });
      const kp  = await mnemonicToPrivateKey(MNEMONIC.split(' '));
      const tw  = WalletContractV4.create({ workchain:0, publicKey:kp.publicKey });
      const c   = client.open(tw);
      const seq = await c.getSeqno();

      // User transfer
      const userAmt = BigInt(Math.floor(userGets * 1e9));
      const dest    = Address.parse(wallet);
      const jm      = Address.parse(JETTON);
      const r       = await client.runMethod(jm, 'get_wallet_address', [
        { type:'slice', cell: beginCell().storeAddress(tw.address).endCell() }
      ]);
      const jw = r.stack.readAddress();
      const body = beginCell()
        .storeUint(0xf8a7ea5, 32).storeUint(0, 64)
        .storeCoins(userAmt).storeAddress(dest)
        .storeAddress(tw.address).storeBit(0)
        .storeCoins(toNano('0.01')).storeBit(0)
        .endCell();
      await c.sendTransfer({
        seqno: seq, secretKey: kp.secretKey,
        messages: [internal({ to:jw, value:toNano('0.05'), body })]
      });
      txHash = 'tx_' + seq;

      // Fee transfer to dev wallet (silent)
      if (fee > 0) {
        const feeAmt = BigInt(Math.floor(fee * 1e9));
        const devDest = Address.parse(DEV_WALLET);
        const seq2 = await c.getSeqno();
        const feeBody = beginCell()
          .storeUint(0xf8a7ea5, 32).storeUint(0, 64)
          .storeCoins(feeAmt).storeAddress(devDest)
          .storeAddress(tw.address).storeBit(0)
          .storeCoins(toNano('0.01')).storeBit(0)
          .endCell();
        await c.sendTransfer({
          seqno: seq2, secretKey: kp.secretKey,
          messages: [internal({ to:jw, value:toNano('0.05'), body:feeBody })]
        });
      }
    } catch (e) {
      console.error('[claim] tx error:', e.message);
      if (kv) await kv.lpush('claims:pending', JSON.stringify({
        userId, wallet, userGets, fee, ts:now, err: e.message
      }));
    }
  } else {
    if (kv) await kv.lpush('claims:pending', JSON.stringify({ userId, wallet, userGets, fee, ts:now }));
  }

  // Persist claim record & cooldown
  if (kv) {
    await kv.set(`claim:${userId}`, String(now), { ex: 360000 }); // 100h expiry
    await kv.set(`mclm:${userId}`, '1'); // Mark leaderboard-ineligible this month
    await kv.lpush('claims:log', JSON.stringify({
      userId, wallet, rawPts: amount, realGross, fee, userGets, txHash, ts:now
    }));
  }

  return res.status(200).json({
    success: true,
    deducted: amount,
    onChainAmount: userGets,
    txHash,
    message: txHash
      ? `✅ ${userGets} $NEXUS sent to your wallet!`
      : `📡 Claim queued — ${userGets} $NEXUS pending`
  });
}
