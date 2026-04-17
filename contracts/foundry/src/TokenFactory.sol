// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title BondingCurveToken
/// @notice An ERC-20 whose price follows a linear bonding curve.
///
///   Notation:
///     s = totalSupply / WAD   (supply in full tokens, e.g. "1000 tokens")
///     price(s) = BASE_PRICE + SLOPE * s   [wei per 1 full token]
///
///   Reserve invariant:
///     ETH balance == ∫₀ˢ price(t) dt
///                 == BASE_PRICE * s + SLOPE * s² / 2
///
///   The invariant holds because fees are taken FROM the trader (on top of the
///   reserve contribution), never from the reserve itself.
///
///   Buy quadratic (x = tokens to mint):
///     SLOPE/2 · x²  +  B · x  −  ethForReserve = 0
///     x = (√(B² + 2·SLOPE·ethForReserve) − B) / SLOPE
///   where B = BASE_PRICE + SLOPE · s   (spot price at current supply)
///   The discriminant is computed at full 256-bit precision — no premature division.
contract BondingCurveToken is ERC20, ReentrancyGuard {
    // ─── Constants ──────────────────────────────────────────────────────────

    /// @notice Starting price in wei per full token (1 token = 1e18 units).
    ///         1e12 wei = 0.000001 ETH per token at supply=0.
    uint256 public constant BASE_PRICE = 1_000_000_000_000; // 1e-6 ETH

    /// @notice Price slope in wei per full token, per full token of supply.
    ///         i.e. price rises by 1e6 wei for every additional full token in supply.
    uint256 public constant SLOPE = 1_000_000;

    /// @notice Creator fee in basis points.
    uint256 public constant FEE_BPS = 100; // 1%

    uint256 private constant BPS_DENOM = 10_000;
    uint256 private constant WAD = 1e18;

    // ─── State ──────────────────────────────────────────────────────────────

    /// @notice Receives 1% of every trade, forever.
    address public immutable creator;

    /// @notice Cumulative ETH fees sent to creator.
    uint256 public creatorFeesEarned;

    // ─── Events ─────────────────────────────────────────────────────────────

    event Trade(
        address indexed trader,
        bool isBuy,
        uint256 tokenAmount,
        uint256 ethAmount,
        uint256 newSupply
    );

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _creator, string memory _name, string memory _symbol)
        ERC20(_name, _symbol)
    {
        require(_creator != address(0), "Zero creator");
        creator = _creator;
    }

    // ─── External: Buy ───────────────────────────────────────────────────────

    /// @notice Send ETH to buy tokens.
    ///         msg.value = reserveContribution + 1% fee.
    function buy() external payable nonReentrant {
        require(msg.value > 0, "Send ETH to buy");

        uint256 fee = (msg.value * FEE_BPS) / BPS_DENOM;
        uint256 ethForReserve = msg.value - fee;

        uint256 tokenAmount = _tokensForEth(ethForReserve, totalSupply());
        require(tokenAmount > 0, "Dust trade");

        creatorFeesEarned += fee;
        _mint(msg.sender, tokenAmount);

        (bool ok, ) = payable(creator).call{value: fee}("");
        require(ok, "Fee transfer failed");

        emit Trade(msg.sender, true, tokenAmount, ethForReserve, totalSupply());
    }

    // ─── External: Sell ──────────────────────────────────────────────────────

    /// @notice Sell `tokenAmount` (in WAD units) and receive ETH minus 1% fee.
    function sell(uint256 tokenAmount) external nonReentrant {
        require(tokenAmount > 0, "Amount is zero");
        require(balanceOf(msg.sender) >= tokenAmount, "Insufficient balance");
        require(tokenAmount <= totalSupply(), "Exceeds supply");

        uint256 grossEth = _ethForTokens(tokenAmount, totalSupply());
        require(grossEth > 0, "Nothing to receive");

        uint256 fee = (grossEth * FEE_BPS) / BPS_DENOM;
        uint256 netEth = grossEth - fee;

        creatorFeesEarned += fee;
        _burn(msg.sender, tokenAmount);

        (bool ok1, ) = payable(creator).call{value: fee}("");
        require(ok1, "Fee transfer failed");

        (bool ok2, ) = payable(msg.sender).call{value: netEth}("");
        require(ok2, "ETH transfer failed");

        emit Trade(msg.sender, false, tokenAmount, netEth, totalSupply());
    }

    // ─── View ────────────────────────────────────────────────────────────────

    /// @notice Spot price in wei per full token at current supply.
    function getCurrentPrice() external view returns (uint256) {
        return _spotPrice(totalSupply());
    }

    /// @notice Estimated tokens received for `ethAmount` wei as reserve contribution.
    function getBuyPrice(uint256 ethAmount) external view returns (uint256) {
        return _tokensForEth(ethAmount, totalSupply());
    }

    /// @notice Estimated ETH received (after fee) for selling `tokenAmount` WAD tokens.
    function getSellReturn(uint256 tokenAmount) external view returns (uint256) {
        uint256 s = totalSupply();
        if (tokenAmount > s) return 0;
        uint256 gross = _ethForTokens(tokenAmount, s);
        return gross - (gross * FEE_BPS) / BPS_DENOM;
    }

    /// @notice Market cap = currentPrice × supply (both in wei / WAD → result in wei).
    function getMarketCap() external view returns (uint256) {
        return (_spotPrice(totalSupply()) * totalSupply()) / WAD;
    }

    // ─── Internal: Math ──────────────────────────────────────────────────────

    /// @dev price(supplyWad) = BASE_PRICE + SLOPE * (supplyWad / WAD)
    function _spotPrice(uint256 supplyWad) internal pure returns (uint256) {
        return BASE_PRICE + (SLOPE * supplyWad) / WAD;
    }

    /// @dev Reserve at supply S (in WAD):
    ///      r(S) = BASE_PRICE * (S/WAD) + SLOPE * (S/WAD)^2 / 2
    function _reserveAt(uint256 supplyWad) internal pure returns (uint256) {
        uint256 s = supplyWad / WAD; // full tokens (integer division intentional)
        return BASE_PRICE * s + (SLOPE * s * s) / 2;
    }

    /// @dev Tokens to mint (WAD) for `ethForReserve` wei injected at `currentSupplyWad`.
    ///
    ///      x (full tokens) = (√(B² + 2·SLOPE·ethForReserve) − B) / SLOPE
    ///      where B = BASE_PRICE + SLOPE · (currentSupplyWad / WAD)
    ///
    ///      Discriminant uses full 256-bit precision before sqrt.
    function _tokensForEth(uint256 ethForReserve, uint256 currentSupplyWad)
        internal
        pure
        returns (uint256)
    {
        uint256 B = BASE_PRICE + (SLOPE * currentSupplyWad) / WAD;

        // No division before sqrt — full 256-bit discriminant.
        uint256 discriminant = B * B + 2 * SLOPE * ethForReserve;
        uint256 sqrtD = _sqrt(discriminant);

        if (sqrtD <= B) return 0;

        // x is in full tokens → convert to WAD
        uint256 xTokens = (sqrtD - B) / SLOPE; // full tokens
        return xTokens * WAD;
    }

    /// @dev ETH (wei) redeemable for burning `amountWad` tokens at `currentSupplyWad`.
    function _ethForTokens(uint256 amountWad, uint256 currentSupplyWad)
        internal
        pure
        returns (uint256)
    {
        if (amountWad > currentSupplyWad) return 0;
        uint256 reserveBefore = _reserveAt(currentSupplyWad);
        uint256 reserveAfter = _reserveAt(currentSupplyWad - amountWad);
        return reserveBefore > reserveAfter ? reserveBefore - reserveAfter : 0;
    }

    /// @dev Integer square root (Babylonian / Newton's method).
    function _sqrt(uint256 x) internal pure returns (uint256 z) {
        if (x == 0) return 0;
        z = x;
        uint256 y = (x + 1) / 2;
        while (y < z) {
            z = y;
            y = (x / y + y) / 2;
        }
    }

    // ─── Fallback ────────────────────────────────────────────────────────────

    receive() external payable {
        revert("Use buy()");
    }
}

// ─────────────────────────────────────────────────────────────────────────────

/// @title TokenFactory
/// @notice Deploys BondingCurveToken contracts and maintains an on-chain registry.
contract TokenFactory {
    address[] public tokens;
    mapping(address => address) public tokenCreator;

    event TokenCreated(
        address indexed token,
        address indexed creator,
        string name,
        string symbol
    );

    /// @notice Deploy a new bonding curve token.
    ///         If msg.value > 0, it is used to seed-buy immediately after deploy.
    function createToken(string calldata _name, string calldata _symbol)
        external
        payable
        returns (address token)
    {
        require(bytes(_name).length > 0, "Name required");
        require(bytes(_symbol).length > 0, "Symbol required");

        BondingCurveToken newToken = new BondingCurveToken(msg.sender, _name, _symbol);
        token = address(newToken);
        tokens.push(token);
        tokenCreator[token] = msg.sender;

        if (msg.value > 0) {
            newToken.buy{value: msg.value}();
        }

        emit TokenCreated(token, msg.sender, _name, _symbol);
    }

    function getTokens() external view returns (address[] memory) {
        return tokens;
    }

    function getTokenCount() external view returns (uint256) {
        return tokens.length;
    }
}
