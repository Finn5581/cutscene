// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {PremarketToken} from "../src/PremarketToken.sol";

contract MockWETH {
    mapping(address => uint256) public balanceOf;

    function deposit() external payable {
        balanceOf[msg.sender] += msg.value;
    }

    function transfer(address to, uint256 v) external returns (bool) {
        balanceOf[msg.sender] -= v;
        balanceOf[to] += v;
        return true;
    }
}

contract MockPair {
    address public lpTo;
    uint256 public mints;

    function mint(address to) external returns (uint256) {
        lpTo = to;
        mints++;
        return 1;
    }
}

contract MockFactory {
    mapping(address => mapping(address => address)) public getPair;

    function createPair(address a, address b) external returns (address p) {
        p = address(new MockPair());
        getPair[a][b] = p;
        getPair[b][a] = p;
    }
}

contract Reenterer {
    PremarketToken t;
    bool tried;
    bool public reentered;

    constructor(PremarketToken t_) {
        t = t_;
    }

    function sellAll(uint256 expiry, bytes32 salt, bytes calldata sig) external {
        t.sell(t.balanceOf(address(this)), 0, expiry, salt, sig);
    }

    function doMint(uint256 expiry, bytes32 salt, bytes calldata sig) external payable {
        t.mint{value: msg.value}(0, expiry, salt, sig);
    }

    receive() external payable {
        if (!tried) {
            tried = true;
            try t.graduate() {
                reentered = true;
            } catch {}
        }
    }
}

contract PremarketTokenTest is Test {
    PremarketToken t;
    MockWETH weth;
    MockFactory factory;
    uint256 gateKey = 0xA11CE;
    address gate;
    uint256 nonce;

    uint256 constant SUPPLY = 1_000_000_000e18;
    uint256 constant VIRTUAL = 1 ether;
    uint256 constant CAP = 0.5 ether;
    uint256 constant TARGET = 3;
    uint256 constant MIN_RAISE = 0.3 ether;
    uint256 constant DURATION = 14 days;

    address alice = address(0xA1);
    address bob = address(0xB0B);
    address carol = address(0xCA);

    function setUp() public {
        gate = vm.addr(gateKey);
        weth = new MockWETH();
        factory = new MockFactory();
        t = new PremarketToken(
            "Test", "TST", SUPPLY, gate, address(factory), address(weth), VIRTUAL, CAP, TARGET, MIN_RAISE, DURATION
        );
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(carol, 10 ether);
    }

    function _voucher(uint256 key, address account, uint8 action)
        internal
        returns (uint256 expiry, bytes32 salt, bytes memory sig)
    {
        expiry = block.timestamp + 5 minutes;
        salt = bytes32(++nonce);
        bytes32 h = keccak256(abi.encode(block.chainid, address(t), account, action, expiry, salt));
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", h));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        sig = abi.encodePacked(r, s, v);
    }

    function _mint(address who, uint256 eth) internal returns (uint256 out) {
        (uint256 e, bytes32 s, bytes memory sig) = _voucher(gateKey, who, 0);
        vm.prank(who);
        out = t.mint{value: eth}(0, e, s, sig);
    }

    function _sell(address who, uint256 tokens) internal returns (uint256 out) {
        (uint256 e, bytes32 s, bytes memory sig) = _voucher(gateKey, who, 1);
        vm.prank(who);
        out = t.sell(tokens, 0, e, s, sig);
    }

    // ------------------------------------------------------------ pre-market

    function test_mintAndSellRoundTripNeverProfits() public {
        uint256 before = alice.balance;
        uint256 out = _mint(alice, 0.2 ether);
        assertEq(t.balanceOf(alice), out);
        _sell(alice, out);
        assertLe(alice.balance, before);
        assertGe(alice.balance, before - 2); // rounding only
    }

    function test_priceRisesOnMintAndFallsOnSell() public {
        uint256 p0 = t.price();
        uint256 out = _mint(alice, 0.2 ether);
        uint256 p1 = t.price();
        assertGt(p1, p0);
        _sell(alice, out / 2);
        assertLt(t.price(), p1);
    }

    function test_mintWithoutVoucherReverts() public {
        vm.prank(alice);
        vm.expectRevert(PremarketToken.BadVoucher.selector);
        t.mint{value: 0.1 ether}(0, block.timestamp + 1, bytes32(0), new bytes(65));
    }

    function test_voucherFromWrongSignerReverts() public {
        (uint256 e, bytes32 s, bytes memory sig) = _voucher(0xBAD, alice, 0);
        vm.prank(alice);
        vm.expectRevert(PremarketToken.BadVoucher.selector);
        t.mint{value: 0.1 ether}(0, e, s, sig);
    }

    function test_voucherCannotBeReplayedOrBorrowed() public {
        (uint256 e, bytes32 s, bytes memory sig) = _voucher(gateKey, alice, 0);
        vm.prank(alice);
        t.mint{value: 0.1 ether}(0, e, s, sig);
        vm.prank(alice);
        vm.expectRevert(PremarketToken.BadVoucher.selector);
        t.mint{value: 0.1 ether}(0, e, s, sig);

        (e, s, sig) = _voucher(gateKey, alice, 0);
        vm.prank(bob); // bob tries to use alice's voucher
        vm.expectRevert(PremarketToken.BadVoucher.selector);
        t.mint{value: 0.1 ether}(0, e, s, sig);
    }

    function test_mintVoucherCannotBeUsedToSell() public {
        uint256 out = _mint(alice, 0.1 ether);
        (uint256 e, bytes32 s, bytes memory sig) = _voucher(gateKey, alice, 0);
        vm.prank(alice);
        vm.expectRevert(PremarketToken.BadVoucher.selector);
        t.sell(out, 0, e, s, sig);
    }

    function test_expiredVoucherReverts() public {
        (uint256 e, bytes32 s, bytes memory sig) = _voucher(gateKey, alice, 0);
        vm.warp(e + 1);
        vm.prank(alice);
        vm.expectRevert(PremarketToken.BadVoucher.selector);
        t.mint{value: 0.1 ether}(0, e, s, sig);
    }

    function test_walletCapEnforced() public {
        _mint(alice, CAP);
        (uint256 e, bytes32 s, bytes memory sig) = _voucher(gateKey, alice, 0);
        vm.prank(alice);
        vm.expectRevert(PremarketToken.CapExceeded.selector);
        t.mint{value: 1}(0, e, s, sig);
    }

    function test_slippageGuard() public {
        uint256 q = t.quoteMint(0.1 ether);
        (uint256 e, bytes32 s, bytes memory sig) = _voucher(gateKey, alice, 0);
        vm.prank(alice);
        vm.expectRevert(PremarketToken.Slippage.selector);
        t.mint{value: 0.1 ether}(q + 1, e, s, sig);
    }

    function test_transfersLockedBeforeGraduation() public {
        uint256 out = _mint(alice, 0.1 ether);
        vm.prank(alice);
        vm.expectRevert(PremarketToken.Locked.selector);
        t.transfer(bob, out);
        vm.prank(alice);
        t.approve(bob, out);
        vm.prank(bob);
        vm.expectRevert(PremarketToken.Locked.selector);
        t.transferFrom(alice, bob, out);
    }

    // ---------------------------------------------------------------- orders

    function test_sellOrderFillsWhenPriceReached() public {
        uint256 out = _mint(alice, 0.1 ether);
        uint256 trigger = (t.price() * 12) / 10;
        (uint256 e, bytes32 s, bytes memory sig) = _voucher(gateKey, alice, 2);
        vm.prank(alice);
        uint256 id = t.placeOrder(false, out, trigger, e, s, sig);
        assertEq(t.balanceOf(alice), 0);

        vm.expectRevert(PremarketToken.NotTriggered.selector);
        t.executeOrder(id);

        _mint(bob, 0.4 ether); // pushes price past the trigger
        assertGe(t.price(), trigger);
        uint256 before = alice.balance;
        vm.prank(carol); // anyone can fill
        t.executeOrder(id);
        assertGt(alice.balance, before + 0.1 ether); // sold above her entry
    }

    function test_buyOrderFillsOnDip() public {
        uint256 out = _mint(alice, 0.4 ether);
        uint256 trigger = (t.price() * 9) / 10;
        (uint256 e, bytes32 s, bytes memory sig) = _voucher(gateKey, bob, 2);
        vm.prank(bob);
        uint256 id = t.placeOrder{value: 0.1 ether}(true, 0, trigger, e, s, sig);

        vm.expectRevert(PremarketToken.NotTriggered.selector);
        t.executeOrder(id);

        _sell(alice, out);
        t.executeOrder(id);
        assertGt(t.balanceOf(bob), 0);
        assertEq(t.uniqueMinters(), 2);
    }

    function test_cancelReturnsEscrowAndOnlyOwnerCanCancel() public {
        uint256 out = _mint(alice, 0.1 ether);
        (uint256 e, bytes32 s, bytes memory sig) = _voucher(gateKey, alice, 2);
        vm.prank(alice);
        uint256 id = t.placeOrder(false, out, type(uint256).max, e, s, sig);
        vm.prank(bob);
        vm.expectRevert(PremarketToken.NotOwner.selector);
        t.cancelOrder(id);
        vm.prank(alice);
        t.cancelOrder(id);
        assertEq(t.balanceOf(alice), out);

        (e, s, sig) = _voucher(gateKey, bob, 2);
        vm.prank(bob);
        id = t.placeOrder{value: 0.2 ether}(true, 0, 0, e, s, sig);
        uint256 before = bob.balance;
        vm.prank(bob);
        t.cancelOrder(id);
        assertEq(bob.balance, before + 0.2 ether);
        assertEq(t.ethSpent(bob), 0);
    }

    function test_orderCannotFillTwice() public {
        (uint256 e, bytes32 s, bytes memory sig) = _voucher(gateKey, bob, 2);
        vm.prank(bob);
        uint256 id = t.placeOrder{value: 0.1 ether}(true, 0, type(uint256).max, e, s, sig);
        t.executeOrder(id);
        vm.expectRevert(PremarketToken.NotTriggered.selector);
        t.executeOrder(id);
    }

    // ------------------------------------------------------------ graduation

    function _fill() internal {
        _mint(alice, 0.2 ether);
        _mint(bob, 0.2 ether);
        _mint(carol, 0.2 ether);
    }

    function test_cannotGraduateEarly() public {
        _mint(alice, 0.4 ether);
        _mint(bob, 0.1 ether);
        vm.expectRevert(PremarketToken.NotReady.selector);
        t.graduate();
    }

    function test_graduateMovesEverythingToPoolAndBurnsLP() public {
        _fill();
        uint256 reserve = t.ethReserve();
        uint256 priceBefore = t.price();
        uint256 circulating = t.balanceOf(alice) + t.balanceOf(bob) + t.balanceOf(carol);
        t.graduate();

        address pair = t.pair();
        assertTrue(t.graduated());
        assertEq(weth.balanceOf(pair), reserve);
        assertEq(MockPair(pair).lpTo(), t.DEAD());
        assertEq(address(t).balance, 0);
        assertEq(t.balanceOf(address(t)), 0);
        // Pool opens at the curve's last price (within rounding).
        uint256 poolPrice = (reserve * 1e18) / t.balanceOf(pair);
        assertApproxEqRel(poolPrice, priceBefore, 1e12);
        assertEq(circulating + t.balanceOf(pair) + t.balanceOf(t.DEAD()), SUPPLY);

        // Token is now a normal ERC-20 and the curve is off.
        vm.prank(alice);
        t.transfer(bob, 1e18);
        (uint256 e, bytes32 s, bytes memory sig) = _voucher(gateKey, alice, 0);
        vm.prank(alice);
        vm.expectRevert(PremarketToken.AlreadyGraduated.selector);
        t.mint{value: 0.01 ether}(0, e, s, sig);
        vm.expectRevert(PremarketToken.NotReady.selector);
        t.graduate();
    }

    function test_graduationSurvivesPreCreatedPairWithDonatedWeth() public {
        address pair = factory.createPair(address(t), address(weth));
        vm.deal(address(this), 1 ether);
        weth.deposit{value: 1 ether}();
        weth.transfer(pair, 1 ether);
        _fill();
        t.graduate();
        assertEq(t.pair(), pair);
        assertEq(MockPair(pair).mints(), 1);
    }

    function test_openOrdersCanBeCancelledAfterGraduation() public {
        uint256 out = _mint(alice, 0.2 ether);
        (uint256 e, bytes32 s, bytes memory sig) = _voucher(gateKey, alice, 2);
        vm.prank(alice);
        uint256 id = t.placeOrder(false, out, type(uint256).max, e, s, sig);
        (e, s, sig) = _voucher(gateKey, bob, 2);
        vm.prank(bob);
        uint256 id2 = t.placeOrder{value: 0.1 ether}(true, 0, 0, e, s, sig);
        _mint(bob, 0.2 ether);
        _mint(carol, 0.2 ether);
        t.graduate();

        vm.prank(alice);
        t.cancelOrder(id);
        assertEq(t.balanceOf(alice), out);
        uint256 before = bob.balance;
        vm.prank(bob);
        t.cancelOrder(id2);
        assertEq(bob.balance, before + 0.1 ether);
    }

    // ---------------------------------------------------------- escape hatch

    function test_afterDeadlineAnyoneCanSellWithoutVoucherAndMintIsClosed() public {
        uint256 a = _mint(alice, 0.2 ether);
        uint256 b = _mint(bob, 0.1 ether);
        vm.warp(block.timestamp + DURATION + 1);
        assertTrue(t.expired());

        (uint256 e, bytes32 s, bytes memory sig) = _voucher(gateKey, carol, 0);
        vm.prank(carol);
        vm.expectRevert(PremarketToken.GateClosed.selector);
        t.mint{value: 0.1 ether}(0, e, s, sig);
        vm.expectRevert(PremarketToken.NotReady.selector);
        t.graduate();

        vm.prank(alice);
        t.sell(a, 0, 0, bytes32(0), "");
        vm.prank(bob);
        t.sell(b, 0, 0, bytes32(0), "");
        assertLe(t.ethReserve(), 2); // everyone got out; only dust is left
        assertEq(address(t).balance, t.ethReserve());
    }

    // ----------------------------------------------------------------- attacks

    function test_reentrancyBlocked() public {
        Reenterer r = new Reenterer(t);
        (uint256 e, bytes32 s, bytes memory sig) = _voucher(gateKey, address(r), 0);
        r.doMint{value: 0.2 ether}(e, s, sig);
        _mint(bob, 0.2 ether);
        _mint(carol, 0.2 ether);
        (e, s, sig) = _voucher(gateKey, address(r), 1);
        r.sellAll(e, s, sig);
        assertFalse(r.reentered());
    }

    function testFuzz_reserveAlwaysCoversEveryHolderExiting(uint96 a, uint96 b, uint96 c, uint8 sellPct) public {
        uint256 ea = bound(a, 1e9, CAP);
        uint256 eb = bound(b, 1e9, CAP);
        uint256 ec = bound(c, 1e9, CAP);
        uint256 ta = _mint(alice, ea);
        uint256 tb = _mint(bob, eb);
        uint256 tc = _mint(carol, ec);
        // partial sell in the middle, then everyone exits in a different order
        uint256 part = (tb * (uint256(sellPct) % 100)) / 100;
        if (part > 0 && t.quoteSell(part) > 0) {
            _sell(bob, part);
            tb -= part;
        }
        if (tc > 0 && t.quoteSell(tc) > 0) _sell(carol, tc);
        if (ta > 0 && t.quoteSell(ta) > 0) _sell(alice, ta);
        if (tb > 0 && t.quoteSell(tb) > 0) _sell(bob, tb);
        // The contract never owes more ETH than it holds.
        assertEq(address(t).balance, t.ethReserve());
        assertGe(t.tokenReserve() + 3, t.balanceOf(address(t)));
    }

    function testFuzz_nobodyProfitsFromRoundTrip(uint96 x, uint96 y) public {
        uint256 ex = bound(x, 1e9, CAP);
        uint256 ey = bound(y, 1e9, CAP);
        _mint(bob, ey); // someone else is already in
        uint256 before = alice.balance;
        uint256 out = _mint(alice, ex);
        if (t.quoteSell(out) > 0) _sell(alice, out);
        assertLe(alice.balance, before);
    }
}
