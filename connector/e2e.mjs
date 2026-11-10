// End-to-end check: local chain + real contract + the connector over MCP.
// Uses only the well-known local test mnemonic. Run: node e2e.mjs
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createPublicClient, createWalletClient, http, parseEther, defineChain } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const ANVIL = process.env.ANVIL || 'anvil';
const RPC = 'http://127.0.0.1:8545';
const PORT = 8787;
const chain = defineChain({ id: 31337, name: 'local', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });
const M = 'test test test test test test test test test test test junk';
const acct = (i) => mnemonicToAccount(M, { addressIndex: i });
const [deployer, gate, alice, bob, carol] = [0, 1, 2, 3, 4].map(acct);
const pub = createPublicClient({ chain, transport: http(RPC) });
const wallet = (a) => createWalletClient({ account: a, chain, transport: http(RPC) });
const art = (file, name) => JSON.parse(readFileSync(new URL(`../out/${file}/${name}.json`, import.meta.url)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const procs = [];
const step = (s) => console.log('ok  ' + s);

async function deploy(a, args = []) {
  const hash = await wallet(deployer).deployContract({ abi: a.abi, bytecode: a.bytecode.object, args });
  return (await pub.waitForTransactionReceipt({ hash })).contractAddress;
}

async function main() {
  procs.push(spawn(ANVIL, ['--silent'], { stdio: 'ignore' }));
  for (let i = 0; i < 50; i++) { try { await pub.getBlockNumber(); break; } catch { await sleep(100); } }

  const weth = await deploy(art('PremarketToken.t.sol', 'MockWETH'));
  const factory = await deploy(art('PremarketToken.t.sol', 'MockFactory'));
  const tokenArt = art('PremarketToken.sol', 'PremarketToken');
  const token = await deploy(tokenArt, ['Test', 'TST', parseEther('1000000000'), gate.address, factory, weth,
    parseEther('1'), parseEther('0.5'), 3n, parseEther('0.3'), 14n * 86400n]);
  step('contract deployed on local chain');

  const srv = spawn('node', ['server.mjs'], {
    cwd: new URL('.', import.meta.url),
    env: { ...process.env, RPC_URL: RPC, TOKEN_ADDRESS: token, CHAIN_ID: '31337', PORT: String(PORT), COOLDOWN_SECONDS: '0',
      GATE_PRIVATE_KEY: '0x' + Buffer.from(gate.getHdKey().privateKey).toString('hex') },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  procs.push(srv);
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/healthz`)).ok) break; } catch { await sleep(100); } }

  const mcp = new Client({ name: 'e2e', version: '0' });
  await mcp.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${PORT}/mcp`)));
  const call = async (name, args = {}) => {
    const r = await mcp.callTool({ name, arguments: args });
    const text = r.content[0].text;
    if (r.isError) throw new Error(text);
    return JSON.parse(text);
  };
  const send = async (a, t) => {
    const hash = await wallet(a).sendTransaction({ to: t.to, data: t.data, value: BigInt(t.value) });
    const rc = await pub.waitForTransactionReceipt({ hash });
    assert.equal(rc.status, 'success');
  };
  const bal = (a) => pub.readContract({ address: token, abi: tokenArt.abi, functionName: 'balanceOf', args: [a.address] });

  const tools = (await mcp.listTools()).tools.map((t) => t.name);
  assert.equal(tools.length, 9);
  step(`connector lists ${tools.length} tools`);

  let s = await call('market_status');
  assert.equal(s.phase, 'premarket');
  const q = await call('quote', { side: 'mint', amount: '0.2' });
  step(`status and quote work (0.2 ETH mints ${Number(q.receive_tokens).toFixed(0)} tokens)`);

  // Mint through the connector.
  const m = await call('prepare_mint', { account: alice.address, eth_amount: '0.2' });
  assert.ok(m.sign_url.includes('/sign#'));
  await send(alice, m);
  assert.ok((await bal(alice)) > 0n);
  step('alice minted with a connector voucher');

  // A voucher made for alice is useless to bob.
  const stolen = await call('prepare_mint', { account: alice.address, eth_amount: '0.1' });
  await assert.rejects(wallet(bob).sendTransaction({ to: stolen.to, data: stolen.data, value: BigInt(stolen.value) }));
  step("bob cannot use alice's voucher");

  // A direct mint with no voucher fails.
  await assert.rejects(wallet(bob).writeContract({ address: token, abi: tokenArt.abi, functionName: 'mint',
    args: [0n, 9999999999n, '0x' + '00'.repeat(32), '0x' + '00'.repeat(65)], value: parseEther('0.1') }));
  step('minting without the connector is rejected');

  // Standing sell order, then a buyer pushes the price past it.
  const pos = await call('my_position', { account: alice.address });
  const half = (Number(pos.tokens) / 2).toFixed(0);
  const trigger = (Number(s.price_eth_per_token) * 1.3).toFixed(18);
  await send(alice, await call('prepare_order', { account: alice.address, side: 'sell', amount: half, trigger_price: trigger }));
  assert.equal((await call('my_position', { account: alice.address })).open_orders.length, 1);
  await send(bob, await call('prepare_mint', { account: bob.address, eth_amount: '0.3' }));
  const before = await pub.getBalance({ address: alice.address });
  await send(carol, await call('prepare_fill_order', { order_id: 0 }));
  assert.ok((await pub.getBalance({ address: alice.address })) > before);
  step("alice's standing sell order filled after the price rose");

  // Sell back through the connector.
  const bobTokens = (await call('my_position', { account: bob.address })).tokens;
  const part = (Number(bobTokens) / 4).toFixed(0);
  const b0 = await pub.getBalance({ address: bob.address });
  await send(bob, await call('prepare_sell', { account: bob.address, token_amount: part }));
  assert.ok((await pub.getBalance({ address: bob.address })) > b0 - parseEther('0.001'));
  step('bob sold part of his tokens back to the reserve');

  // Launch needs three minters and 0.3 ETH.
  await assert.rejects(call('prepare_launch'));
  await send(carol, await call('prepare_mint', { account: carol.address, eth_amount: '0.2' }));
  s = await call('market_status');
  assert.equal(s.ready_to_launch, true);
  await send(carol, await call('prepare_launch'));
  s = await call('market_status');
  assert.equal(s.phase, 'graduated');
  assert.ok(s.pool);
  step('launch moved the reserve into the pool');

  await assert.rejects(call('prepare_mint', { account: alice.address, eth_amount: '0.01' }));
  const h = await wallet(alice).writeContract({ address: token, abi: tokenArt.abi, functionName: 'transfer', args: [bob.address, 1n] });
  assert.equal((await pub.waitForTransactionReceipt({ hash: h })).status, 'success');
  step('after launch the pre-market is closed and transfers work');

  const page = await (await fetch(`http://127.0.0.1:${PORT}/sign`)).text();
  assert.ok(page.toLowerCase().includes(token.toLowerCase()));
  step('signing page is served and pinned to the token contract');
  await mcp.close();
  console.log('\nALL END-TO-END CHECKS PASSED');
}

main().then(() => 0, (e) => { console.error('FAILED:', e); return 1; }).then((code) => {
  for (const p of procs) p.kill();
  process.exit(code);
});
