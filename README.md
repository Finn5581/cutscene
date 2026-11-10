# Pre-market token

A token that is its own market before a DEX pool exists, built for Robinhood Chain (EVM, chain ID 4663; testnet 46630).

## How it works

1. **Pre-market.** The contract sells tokens along a price curve and buys them back from the same reserve. Each mint, sell or order needs a short-lived voucher signed by the gate (your MCP server). Tokens cannot move between wallets.
2. **Standing orders.** A holder can leave "sell X when the price reaches P" or "buy with Y ETH when the price drops to P". Once the price is there, anyone can trigger the fill.
3. **Graduation.** When enough unique minters and ETH are in, anyone can call `graduate()`. The whole reserve and a price-matched amount of tokens go into a Uniswap v2 pair, the LP tokens are burned, unsold curve tokens are burned, and the token becomes a normal ERC-20.
4. **Escape hatch.** If graduation has not happened by the deadline, minting stops and holders can sell back to the reserve without a voucher.

There is no owner, fee, team allocation or upgrade path.

## Run the tests

```
forge install foundry-rs/forge-std
forge test
```

22 tests pass, including two fuzz tests (reserve always covers every holder exiting; nobody profits from a round trip). `connector/e2e.mjs` checks the contract and connector together on a local chain.

## Settings (constructor)

| Setting | Meaning |
| --- | --- |
| `supply_` | Total tokens, all held by the curve at the start |
| `gateSigner_` | Address of the key your MCP server signs vouchers with |
| `factory_`, `weth_` | Uniswap v2 factory and WETH on the target chain |
| `virtualEth_` | Sets the starting price: `virtualEth / supply` |
| `maxEthPerWallet_` | Most ETH one wallet can put in before graduation |
| `targetMinters_`, `minRaise_` | Both must be reached to graduate |
| `gateDuration_` | Seconds until the escape hatch opens |

## Not done yet

- **Hosting the connector.** The MCP server in `connector/` works on a local chain but is not deployed anywhere. See `connector/README.md`.
- **A test against real Uniswap.** Graduation is tested with stand-in pool contracts. It still needs a run on Robinhood Chain testnet with the real v2 factory and WETH addresses, which have to be looked up and verified.
- **An audit.** This code has not been reviewed by anyone else. Do not put real money in it before an independent audit.
- **Legal review.** See THREATS.md.
