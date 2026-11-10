# Connector

The MCP server that sits between an AI assistant and the pre-market contract. It reads the curve, signs gate vouchers and prepares transactions. It never holds user funds or user keys: every transaction is signed by the user in their own wallet, through the `/sign` page.

## Tools

| Tool | What it does |
| --- | --- |
| `market_status` | Price, reserve, progress toward launch, deadline |
| `quote` | Tokens for an ETH amount, or ETH for a token amount |
| `my_position` | A wallet's balance, spend against its cap, open orders |
| `prepare_mint` | Voucher + transaction to mint |
| `prepare_sell` | Voucher + transaction to sell back |
| `prepare_order` | Voucher + transaction for a standing buy or sell order |
| `prepare_cancel_order` | Transaction to cancel an order |
| `prepare_fill_order` | Transaction to fill an order whose price was reached |
| `prepare_launch` | Transaction to move the reserve into the DEX pool |

Each `prepare_*` tool returns the transaction and a `sign_url`. The signing page refuses any transaction that is not addressed to the token contract.

## Run

```
npm install
cp .env.example .env   # fill it in
node --env-file=.env server.mjs
```

The server refuses to start if `GATE_PRIVATE_KEY` does not match the contract's `gateSigner`.

## End-to-end check

From the project root run `forge build`, then here:

```
node e2e.mjs
```

It starts a local chain, deploys the contract, drives the connector over MCP and sends the prepared transactions: mint, a stolen voucher, a mint with no voucher, a standing order, a sell, launch, and post-launch behaviour.

## Not done yet

- **Hosting.** To add this to Claude as a custom connector it has to run at a public HTTPS address.
- **Restricting it to Claude.** Any MCP client can connect today. Limiting it to one client needs OAuth with an allow-list of client IDs.
- **Real limits on voucher farming.** The only brake is a per-wallet cooldown held in memory. One person with many wallets is not stopped.
- **The signing page with a real wallet.** It is served and pinned to the contract, but has not been clicked through in a browser wallet.
- **Automatic order fills.** Nothing watches the price. Someone has to ask for `prepare_fill_order`.
