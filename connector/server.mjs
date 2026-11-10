// Pre-market connector: an MCP server that quotes the curve, signs gate
// vouchers and prepares transactions. It never holds user funds or user keys.
// The user signs every transaction in their own wallet.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import * as z from 'zod/v4';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import {
  createPublicClient, http, parseAbi, encodeFunctionData, encodeAbiParameters,
  keccak256, parseEther, formatEther, isAddress, getAddress, toHex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const need = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing environment variable ${k}`);
  return v;
};
const RPC_URL = need('RPC_URL');
const TOKEN = getAddress(need('TOKEN_ADDRESS'));
const CHAIN_ID = Number(need('CHAIN_ID'));
const gate = privateKeyToAccount(need('GATE_PRIVATE_KEY'));
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://${HOST}:${PORT}`).replace(/\/$/, '');
const VOUCHER_TTL = Number(process.env.VOUCHER_TTL_SECONDS || 300);
const COOLDOWN_MS = Number(process.env.COOLDOWN_SECONDS || 10) * 1000;
const DEFAULT_SLIPPAGE_BPS = 100; // 1%

const abi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function price() view returns (uint256)',
  'function ethReserve() view returns (uint256)',
  'function tokenReserve() view returns (uint256)',
  'function uniqueMinters() view returns (uint256)',
  'function targetMinters() view returns (uint256)',
  'function minRaise() view returns (uint256)',
  'function maxEthPerWallet() view returns (uint256)',
  'function gateDeadline() view returns (uint256)',
  'function gateSigner() view returns (address)',
  'function graduated() view returns (bool)',
  'function expired() view returns (bool)',
  'function canGraduate() view returns (bool)',
  'function pair() view returns (address)',
  'function balanceOf(address) view returns (uint256)',
  'function ethSpent(address) view returns (uint256)',
  'function quoteMint(uint256) view returns (uint256)',
  'function quoteSell(uint256) view returns (uint256)',
  'function ordersLength() view returns (uint256)',
  'function orders(uint256) view returns (address owner, bool isBuy, uint256 amount, uint256 triggerPrice, bool open)',
  'function mint(uint256 minTokensOut, uint256 expiry, bytes32 salt, bytes sig) payable returns (uint256)',
  'function sell(uint256 tokensIn, uint256 minEthOut, uint256 expiry, bytes32 salt, bytes sig) returns (uint256)',
  'function placeOrder(bool isBuy, uint256 amount, uint256 triggerPrice, uint256 expiry, bytes32 salt, bytes sig) payable returns (uint256)',
  'function executeOrder(uint256 id)',
  'function cancelOrder(uint256 id)',
  'function graduate()',
]);

const client = createPublicClient({ transport: http(RPC_URL) });
const read = (functionName, args = []) => client.readContract({ address: TOKEN, abi, functionName, args });

const ACT = { mint: 0, sell: 1, order: 2 };
const lastVoucher = new Map(); // account -> ms; basic brake on voucher farming

async function voucher(account, action) {
  const now = Date.now();
  const prev = lastVoucher.get(account) || 0;
  if (now - prev < COOLDOWN_MS) {
    throw new Error(`Please wait ${Math.ceil((COOLDOWN_MS - (now - prev)) / 1000)}s before the next action for this wallet.`);
  }
  lastVoucher.set(account, now);
  const block = await client.getBlock();
  const expiry = block.timestamp + BigInt(VOUCHER_TTL);
  const salt = toHex(randomBytes(32));
  const h = keccak256(encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'address' }, { type: 'address' }, { type: 'uint8' }, { type: 'uint256' }, { type: 'bytes32' }],
    [BigInt(CHAIN_ID), TOKEN, account, action, expiry, salt],
  ));
  const sig = await gate.signMessage({ message: { raw: h } });
  return { expiry, salt, sig };
}

function tx(functionName, args, value, summary) {
  const t = {
    chainId: CHAIN_ID,
    to: TOKEN,
    data: encodeFunctionData({ abi, functionName, args }),
    value: toHex(value),
    summary,
  };
  const frag = Buffer.from(JSON.stringify(t)).toString('base64url');
  return { ...t, sign_url: `${PUBLIC_URL}/sign#${frag}`, voucher_valid_seconds: VOUCHER_TTL };
}

const ok = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
const fail = (e) => ({ isError: true, content: [{ type: 'text', text: String(e?.shortMessage || e?.message || e) }] });
const wrap = (fn) => async (args) => { try { return ok(await fn(args)); } catch (e) { return fail(e); } };

const addr = z.string().refine(isAddress, 'Not a valid wallet address').describe("The user's own wallet address (0x...)");
const amount = (what) => z.string().regex(/^\d+(\.\d+)?$/, 'Use a plain decimal number').describe(what);
const slip = z.number().int().min(0).max(5000).optional().describe('Allowed slippage in basis points (100 = 1%). Default 100.');
const minOut = (q, bps = DEFAULT_SLIPPAGE_BPS) => (q * BigInt(10000 - bps)) / 10000n;

async function phase() {
  const [graduated, expired] = await Promise.all([read('graduated'), read('expired')]);
  return graduated ? 'graduated' : expired ? 'expired' : 'premarket';
}
async function requirePremarket() {
  const p = await phase();
  if (p === 'graduated') throw new Error('The token has launched. Trade it on a DEX; the pre-market is closed.');
  if (p === 'expired') throw new Error('The pre-market deadline passed without launch. Minting is closed; holders can still sell back.');
}

function buildServer() {
  const server = new McpServer({ name: 'premarket-connector', version: '0.1.0' });

  server.registerTool('market_status', {
    description: 'Current state of the pre-market: price, reserve, progress toward launch, deadline. Read-only.',
    inputSchema: {},
  }, wrap(async () => {
    const [name, symbol, price, ethReserve, minters, target, minRaise, cap, deadline, canGraduate, pair, p] = await Promise.all([
      read('name'), read('symbol'), read('price'), read('ethReserve'), read('uniqueMinters'), read('targetMinters'),
      read('minRaise'), read('maxEthPerWallet'), read('gateDeadline'), read('canGraduate'), read('pair'), phase(),
    ]);
    return {
      token: `${name} (${symbol})`, contract: TOKEN, chain_id: CHAIN_ID, phase: p,
      price_eth_per_token: formatEther(price), reserve_eth: formatEther(ethReserve),
      unique_minters: `${minters} of ${target} needed`, min_raise_eth: formatEther(minRaise),
      max_eth_per_wallet: formatEther(cap), deadline_unix: Number(deadline),
      ready_to_launch: canGraduate, pool: p === 'graduated' ? pair : null,
    };
  }));

  server.registerTool('quote', {
    description: 'How many tokens a given ETH amount mints right now, or how much ETH a given token amount sells for. Read-only.',
    inputSchema: { side: z.enum(['mint', 'sell']), amount: amount('ETH to spend (mint) or tokens to sell (sell)') },
  }, wrap(async ({ side, amount: a }) => {
    const v = parseEther(a);
    if (side === 'mint') return { spend_eth: a, receive_tokens: formatEther(await read('quoteMint', [v])) };
    return { sell_tokens: a, receive_eth: formatEther(await read('quoteSell', [v])) };
  }));

  server.registerTool('my_position', {
    description: "A wallet's token balance, ETH spent toward its cap, and open orders. Read-only.",
    inputSchema: { account: addr },
  }, wrap(async ({ account }) => {
    const a = getAddress(account);
    const [bal, spent, cap, n] = await Promise.all([read('balanceOf', [a]), read('ethSpent', [a]), read('maxEthPerWallet'), read('ordersLength')]);
    const open = [];
    for (let i = 0n; i < n; i++) {
      const [owner, isBuy, amt, trigger, isOpen] = await read('orders', [i]);
      if (isOpen && owner === a) {
        open.push({ id: Number(i), side: isBuy ? 'buy' : 'sell', amount: formatEther(amt) + (isBuy ? ' ETH' : ' tokens'), trigger_eth_per_token: formatEther(trigger) });
      }
    }
    return { tokens: formatEther(bal), eth_spent: formatEther(spent), eth_cap: formatEther(cap), open_orders: open };
  }));

  server.registerTool('prepare_mint', {
    description: 'Prepare a pre-market mint for the user to sign in their own wallet. Confirm the ETH amount with the user first. Returns a transaction and a signing link; nothing is sent until the user signs.',
    inputSchema: { account: addr, eth_amount: amount('ETH to spend'), slippage_bps: slip },
  }, wrap(async ({ account, eth_amount, slippage_bps }) => {
    await requirePremarket();
    const a = getAddress(account);
    const value = parseEther(eth_amount);
    const q = await read('quoteMint', [value]);
    const { expiry, salt, sig } = await voucher(a, ACT.mint);
    return tx('mint', [minOut(q, slippage_bps), expiry, salt, sig], value, `Mint about ${formatEther(q)} tokens for ${eth_amount} ETH`);
  }));

  server.registerTool('prepare_sell', {
    description: 'Prepare selling tokens back to the pre-market reserve, for the user to sign in their own wallet. Confirm the amount with the user first.',
    inputSchema: { account: addr, token_amount: amount('Tokens to sell'), slippage_bps: slip },
  }, wrap(async ({ account, token_amount, slippage_bps }) => {
    const p = await phase();
    if (p === 'graduated') throw new Error('The token has launched. Sell it on a DEX.');
    const a = getAddress(account);
    const v = parseEther(token_amount);
    const q = await read('quoteSell', [v]);
    const summary = `Sell ${token_amount} tokens for about ${formatEther(q)} ETH`;
    if (p === 'expired') return tx('sell', [v, minOut(q, slippage_bps), 0n, toHex(0, { size: 32 }), '0x'], 0n, summary);
    const { expiry, salt, sig } = await voucher(a, ACT.sell);
    return tx('sell', [v, minOut(q, slippage_bps), expiry, salt, sig], 0n, summary);
  }));

  server.registerTool('prepare_order', {
    description: 'Prepare a standing order for the user to sign: "sell N tokens when the price reaches P" or "buy with N ETH when the price drops to P". The amount is held by the contract until the order fills or is cancelled.',
    inputSchema: {
      account: addr, side: z.enum(['buy', 'sell']),
      amount: amount('ETH to spend (buy) or tokens to sell (sell)'),
      trigger_price: amount('Trigger price in ETH per token'),
    },
  }, wrap(async ({ account, side, amount: amt, trigger_price }) => {
    await requirePremarket();
    const a = getAddress(account);
    const v = parseEther(amt);
    const trig = parseEther(trigger_price);
    const { expiry, salt, sig } = await voucher(a, ACT.order);
    const isBuy = side === 'buy';
    return tx('placeOrder', [isBuy, isBuy ? 0n : v, trig, expiry, salt, sig], isBuy ? v : 0n,
      isBuy ? `Buy with ${amt} ETH if the price drops to ${trigger_price} ETH` : `Sell ${amt} tokens if the price reaches ${trigger_price} ETH`);
  }));

  server.registerTool('prepare_cancel_order', {
    description: "Prepare cancelling one of the user's open orders. The held amount goes back to them.",
    inputSchema: { order_id: z.number().int().min(0) },
  }, wrap(async ({ order_id }) => tx('cancelOrder', [BigInt(order_id)], 0n, `Cancel order #${order_id}`)));

  server.registerTool('prepare_fill_order', {
    description: 'Prepare filling an order whose trigger price has been reached. Anyone can send this.',
    inputSchema: { order_id: z.number().int().min(0) },
  }, wrap(async ({ order_id }) => {
    await requirePremarket();
    return tx('executeOrder', [BigInt(order_id)], 0n, `Fill order #${order_id}`);
  }));

  server.registerTool('prepare_launch', {
    description: 'Prepare the launch transaction that moves the reserve into a DEX pool. Only works once the targets are met. Anyone can send it.',
    inputSchema: {},
  }, wrap(async () => {
    if (!(await read('canGraduate'))) throw new Error('Not ready to launch yet. Check market_status for progress.');
    return tx('graduate', [], 0n, 'Launch: move the reserve into the DEX pool');
  }));

  return server;
}

const app = createMcpExpressApp({ host: HOST, allowedHosts: process.env.ALLOWED_HOSTS?.split(',') });

app.post('/mcp', async (req, res) => {
  const server = buildServer();
  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => { transport.close(); server.close(); });
  } catch (e) {
    console.error('MCP request failed:', e);
    if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
  }
});
const notAllowed = (_req, res) => res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
app.get('/mcp', notAllowed);
app.delete('/mcp', notAllowed);

const signPage = readFileSync(new URL('./sign.html', import.meta.url), 'utf8')
  .replaceAll('__TOKEN__', TOKEN).replaceAll('__CHAIN_ID__', String(CHAIN_ID));
app.get('/sign', (_req, res) => res.type('html').send(signPage));
app.get('/healthz', (_req, res) => res.json({ ok: true }));

const onChainSigner = await read('gateSigner');
if (onChainSigner !== gate.address) {
  throw new Error(`GATE_PRIVATE_KEY (${gate.address}) does not match the contract's gateSigner (${onChainSigner}).`);
}
app.listen(PORT, HOST, () => console.log(`premarket connector on ${PUBLIC_URL}/mcp for token ${TOKEN} (chain ${CHAIN_ID})`));
