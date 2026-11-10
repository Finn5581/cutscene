# Threats and how they are handled

## Covered by a test

| Attack | Defence | Test |
| --- | --- | --- |
| Trade without going through the gate | Every pre-market action needs a signed voucher | `test_mintWithoutVoucherReverts`, `test_voucherFromWrongSignerReverts` |
| Reuse a voucher, or use someone else's | Vouchers are single-use and bound to one wallet, one action, one contract, one chain | `test_voucherCannotBeReplayedOrBorrowed`, `test_mintVoucherCannotBeUsedToSell`, `test_expiredVoucherReverts` |
| Open a pool or sell privately before launch | Transfers revert until graduation | `test_transfersLockedBeforeGraduation` |
| One wallet buys most of the curve | Per-wallet ETH cap | `test_walletCapEnforced` |
| Drain the reserve | Sell payouts are bounded by the curve; fuzzed | `testFuzz_reserveAlwaysCoversEveryHolderExiting` |
| Mint and sell for a profit | Fuzzed round trips never gain | `testFuzz_nobodyProfitsFromRoundTrip` |
| Block the launch by pre-creating the pair and donating WETH | The pair is funded directly, not through the router | `test_graduationSurvivesPreCreatedPairWithDonatedWeth` |
| Re-enter during a payout | Reentrancy lock on every state-changing entry point | `test_reentrancyBlocked` |
| Gate server disappears and funds are stuck | After the deadline anyone can sell back without a voucher | `test_afterDeadlineAnyoneCanSellWithoutVoucherAndMintIsClosed` |
| Order escrow stuck after launch | Orders can always be cancelled by their owner | `test_openOrdersCanBeCancelledAfterGraduation` |

## Known and not solved in the contract

- **Many wallets, one person.** The wallet cap and the unique-minter target can both be gamed by someone using many wallets. The only brake is the gate server, which has to rate-limit who gets vouchers.
- **Front-running.** Robinhood Chain orders transactions through a sequencer. A trade can still land just before yours and move the price. The `minOut` arguments limit the damage; they do not remove it.
- **Order fills are not automatic.** Someone has to call `executeOrder`. A large order also moves the price as it fills, so the average fill can be worse than the trigger.
- **The gate key is a single point of failure.** Whoever holds it can issue vouchers to anyone. If it leaks, the gate is open, though the wallet cap and curve still apply.
- **A server outage freezes trading until the deadline.** Holders cannot exit early if the gate is down.
- **Buyers above the curve can lose money.** After graduation the price is set by the pool and can fall below what anyone paid.

## Outside the code

- **Regulation.** Selling a token to the public and running the only way to trade it are both regulated activities in the US and elsewhere. Have a lawyer review this before any mainnet launch.
- **Audit.** None yet.
