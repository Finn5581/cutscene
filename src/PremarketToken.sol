// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IUniswapV2Factory {
    function getPair(address a, address b) external view returns (address);
    function createPair(address a, address b) external returns (address);
}

interface IUniswapV2Pair {
    function mint(address to) external returns (uint256 liquidity);
}

interface IWETH {
    function deposit() external payable;
    function transfer(address to, uint256 value) external returns (bool);
}

/// @title PremarketToken
/// @notice An ERC-20 that is its own market before a DEX pool exists.
///
/// Phase 1 (pre-market): the contract sells and buys back tokens along a
/// constant-product curve with a virtual ETH reserve. Every trade needs a
/// short-lived voucher signed by the gate signer (the MCP server), so trading
/// only happens through the connector. Tokens cannot be transferred between
/// wallets, so nobody can open a pool early.
///
/// Phase 2 (graduated): once enough unique minters and ETH are in, anyone can
/// call graduate(). The whole ETH reserve and a price-matched amount of tokens
/// go into a Uniswap v2 pair, the LP tokens are burned, leftover curve tokens
/// are burned, and the token becomes a normal freely transferable ERC-20.
///
/// Escape hatch: if graduation has not happened by `gateDeadline`, the gate
/// drops, minting stops, and holders can sell back to the reserve directly.
///
/// There is no owner, no fee, no team allocation and no upgrade path.
contract PremarketToken {
    // ---------------------------------------------------------------- ERC-20
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // ------------------------------------------------------------ immutables
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;
    address public immutable gateSigner;
    address public immutable factory;
    address public immutable weth;
    uint256 public immutable virtualEth; // sets the starting price
    uint256 public immutable maxEthPerWallet; // lifetime pre-market spend cap
    uint256 public immutable targetMinters; // unique minters needed to graduate
    uint256 public immutable minRaise; // ETH reserve needed to graduate
    uint256 public immutable gateDeadline; // escape hatch time

    // ----------------------------------------------------------- curve state
    uint256 public ethReserve; // real ETH backing the curve
    uint256 public tokenReserve; // tokens the curve still holds for sale
    uint256 public uniqueMinters;
    bool public graduated;
    address public pair;

    mapping(address => uint256) public ethSpent;
    mapping(address => bool) public hasMinted;
    mapping(bytes32 => bool) public voucherUsed;

    // ---------------------------------------------------------------- orders
    struct Order {
        address owner;
        bool isBuy; // buy: spend `amount` ETH when price <= trigger
        //            sell: sell `amount` tokens when price >= trigger
        uint256 amount;
        uint256 triggerPrice; // wei per whole token (1e18 units)
        bool open;
    }

    Order[] public orders;

    uint8 internal constant ACT_MINT = 0;
    uint8 internal constant ACT_SELL = 1;
    uint8 internal constant ACT_ORDER = 2;

    event Minted(address indexed account, uint256 ethIn, uint256 tokensOut);
    event Sold(address indexed account, uint256 tokensIn, uint256 ethOut);
    event OrderPlaced(uint256 indexed id, address indexed owner, bool isBuy, uint256 amount, uint256 triggerPrice);
    event OrderFilled(uint256 indexed id, uint256 amountIn, uint256 amountOut);
    event OrderCancelled(uint256 indexed id);
    event Graduated(address pair, uint256 ethToPool, uint256 tokensToPool, uint256 tokensBurned);

    error Locked();
    error BadVoucher();
    error GateClosed();
    error AlreadyGraduated();
    error NotReady();
    error Slippage();
    error CapExceeded();
    error ZeroAmount();
    error NotTriggered();
    error NotOwner();
    error TransferFailed();
    error Reentrancy();

    uint256 private _lock = 1;

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 supply_,
        address gateSigner_,
        address factory_,
        address weth_,
        uint256 virtualEth_,
        uint256 maxEthPerWallet_,
        uint256 targetMinters_,
        uint256 minRaise_,
        uint256 gateDuration_
    ) {
        require(supply_ > 0 && virtualEth_ > 0 && gateSigner_ != address(0), "bad config");
        require(factory_ != address(0) && weth_ != address(0), "bad dex");
        name = name_;
        symbol = symbol_;
        gateSigner = gateSigner_;
        factory = factory_;
        weth = weth_;
        virtualEth = virtualEth_;
        maxEthPerWallet = maxEthPerWallet_;
        targetMinters = targetMinters_;
        minRaise = minRaise_;
        gateDeadline = block.timestamp + gateDuration_;

        totalSupply = supply_;
        balanceOf[address(this)] = supply_;
        tokenReserve = supply_;
        emit Transfer(address(0), address(this), supply_);
    }

    // ------------------------------------------------------------------ views

    /// @notice Current curve price in wei per whole token.
    function price() public view returns (uint256) {
        if (tokenReserve == 0) return 0;
        return ((virtualEth + ethReserve) * 1e18) / tokenReserve;
    }

    function quoteMint(uint256 ethIn) public view returns (uint256) {
        uint256 e = virtualEth + ethReserve;
        return (tokenReserve * ethIn) / (e + ethIn);
    }

    function quoteSell(uint256 tokensIn) public view returns (uint256) {
        uint256 e = virtualEth + ethReserve;
        return (e * tokensIn) / (tokenReserve + tokensIn);
    }

    function expired() public view returns (bool) {
        return !graduated && block.timestamp > gateDeadline;
    }

    function canGraduate() public view returns (bool) {
        return !graduated && !expired() && uniqueMinters >= targetMinters && ethReserve >= minRaise;
    }

    function ordersLength() external view returns (uint256) {
        return orders.length;
    }

    // --------------------------------------------------------------- pre-market

    /// @notice Buy from the curve. Needs a mint voucher from the gate.
    function mint(uint256 minTokensOut, uint256 expiry, bytes32 salt, bytes calldata sig)
        external
        payable
        nonReentrant
        returns (uint256 tokensOut)
    {
        if (graduated) revert AlreadyGraduated();
        if (expired()) revert GateClosed();
        _useVoucher(msg.sender, ACT_MINT, expiry, salt, sig);
        _countSpend(msg.sender, msg.value);
        tokensOut = _buy(msg.sender, msg.value);
        if (tokensOut < minTokensOut) revert Slippage();
        emit Minted(msg.sender, msg.value, tokensOut);
    }

    /// @notice Sell back to the curve. Needs a sell voucher from the gate
    /// unless the gate deadline has passed without graduation.
    function sell(uint256 tokensIn, uint256 minEthOut, uint256 expiry, bytes32 salt, bytes calldata sig)
        external
        nonReentrant
        returns (uint256 ethOut)
    {
        if (graduated) revert AlreadyGraduated();
        if (!expired()) _useVoucher(msg.sender, ACT_SELL, expiry, salt, sig);
        ethOut = _sell(msg.sender, tokensIn);
        if (ethOut < minEthOut) revert Slippage();
        _send(msg.sender, ethOut);
        emit Sold(msg.sender, tokensIn, ethOut);
    }

    // ------------------------------------------------------------------ orders

    /// @notice Place a standing order. A buy order escrows ETH (msg.value);
    /// a sell order escrows `amount` tokens. Needs an order voucher.
    function placeOrder(bool isBuy, uint256 amount, uint256 triggerPrice, uint256 expiry, bytes32 salt, bytes calldata sig)
        external
        payable
        nonReentrant
        returns (uint256 id)
    {
        if (graduated) revert AlreadyGraduated();
        if (expired()) revert GateClosed();
        _useVoucher(msg.sender, ACT_ORDER, expiry, salt, sig);
        if (isBuy) {
            amount = msg.value;
            if (amount == 0) revert ZeroAmount();
            _countSpend(msg.sender, amount);
        } else {
            if (amount == 0 || msg.value != 0) revert ZeroAmount();
            _move(msg.sender, address(this), amount);
        }
        id = orders.length;
        orders.push(Order(msg.sender, isBuy, amount, triggerPrice, true));
        emit OrderPlaced(id, msg.sender, isBuy, amount, triggerPrice);
    }

    /// @notice Fill an order whose trigger has been reached. Anyone can call.
    function executeOrder(uint256 id) external nonReentrant {
        if (graduated) revert AlreadyGraduated();
        if (expired()) revert GateClosed();
        Order storage o = orders[id];
        if (!o.open) revert NotTriggered();
        uint256 p = price();
        if (o.isBuy ? p > o.triggerPrice : p < o.triggerPrice) revert NotTriggered();
        o.open = false;
        if (o.isBuy) {
            uint256 tokensOut = _buy(o.owner, o.amount);
            emit OrderFilled(id, o.amount, tokensOut);
        } else {
            uint256 ethOut = _sell(address(this), o.amount);
            _send(o.owner, ethOut);
            emit OrderFilled(id, o.amount, ethOut);
        }
    }

    /// @notice Cancel your order and get the escrow back. Always available.
    function cancelOrder(uint256 id) external nonReentrant {
        Order storage o = orders[id];
        if (o.owner != msg.sender) revert NotOwner();
        if (!o.open) revert NotTriggered();
        o.open = false;
        if (o.isBuy) {
            ethSpent[msg.sender] -= o.amount;
            _send(msg.sender, o.amount);
        } else {
            _move(address(this), msg.sender, o.amount);
        }
        emit OrderCancelled(id);
    }

    // -------------------------------------------------------------- graduation

    /// @notice Deploy the pool. Anyone can call once the targets are met.
    function graduate() external nonReentrant {
        if (!canGraduate()) revert NotReady();
        graduated = true;

        uint256 ethToPool = ethReserve;
        // Match the pool's opening price to the curve's current price.
        uint256 tokensToPool = (ethToPool * tokenReserve) / (virtualEth + ethToPool);
        uint256 burned = tokenReserve - tokensToPool;
        ethReserve = 0;
        tokenReserve = 0;

        address p = IUniswapV2Factory(factory).getPair(address(this), weth);
        if (p == address(0)) p = IUniswapV2Factory(factory).createPair(address(this), weth);
        pair = p;

        // Fund the pair directly instead of through the router, so WETH
        // donated to a pre-created pair cannot block the launch.
        IWETH(weth).deposit{value: ethToPool}();
        if (!IWETH(weth).transfer(p, ethToPool)) revert TransferFailed();
        _move(address(this), p, tokensToPool);
        IUniswapV2Pair(p).mint(DEAD);

        if (burned > 0) _move(address(this), DEAD, burned);
        emit Graduated(p, ethToPool, tokensToPool, burned);
    }

    // ----------------------------------------------------------------- ERC-20

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        if (!graduated) revert Locked();
        _move(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        if (!graduated) revert Locked();
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) allowance[from][msg.sender] = a - value;
        _move(from, to, value);
        return true;
    }

    // --------------------------------------------------------------- internals

    function _move(address from, address to, uint256 value) internal {
        balanceOf[from] -= value;
        unchecked {
            balanceOf[to] += value;
        }
        emit Transfer(from, to, value);
    }

    function _countSpend(address account, uint256 ethIn) internal {
        if (ethIn == 0) revert ZeroAmount();
        uint256 spent = ethSpent[account] + ethIn;
        if (spent > maxEthPerWallet) revert CapExceeded();
        ethSpent[account] = spent;
    }

    function _buy(address to, uint256 ethIn) internal returns (uint256 tokensOut) {
        tokensOut = quoteMint(ethIn);
        if (tokensOut == 0) revert ZeroAmount();
        ethReserve += ethIn;
        tokenReserve -= tokensOut;
        _move(address(this), to, tokensOut);
        if (!hasMinted[to]) {
            hasMinted[to] = true;
            uniqueMinters += 1;
        }
    }

    /// @dev `from` holds the tokens (the seller, or this contract for an
    /// escrowed sell order). The caller pays `ethOut` to the right account.
    function _sell(address from, uint256 tokensIn) internal returns (uint256 ethOut) {
        if (tokensIn == 0) revert ZeroAmount();
        ethOut = quoteSell(tokensIn);
        if (ethOut > ethReserve) ethOut = ethReserve;
        if (ethOut == 0) revert ZeroAmount();
        ethReserve -= ethOut;
        tokenReserve += tokensIn;
        if (from != address(this)) _move(from, address(this), tokensIn);
    }

    function _send(address to, uint256 amount) internal {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    function _useVoucher(address account, uint8 action, uint256 expiry, bytes32 salt, bytes calldata sig) internal {
        if (block.timestamp > expiry) revert BadVoucher();
        bytes32 h = keccak256(abi.encode(block.chainid, address(this), account, action, expiry, salt));
        if (voucherUsed[h]) revert BadVoucher();
        voucherUsed[h] = true;
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", h));
        if (sig.length != 65) revert BadVoucher();
        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);
        uint8 v = uint8(sig[64]);
        // Reject malleable signatures.
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) revert BadVoucher();
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0) || signer != gateSigner) revert BadVoucher();
    }
}
