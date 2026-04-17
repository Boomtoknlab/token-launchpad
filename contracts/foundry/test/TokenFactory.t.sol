// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/TokenFactory.sol";

contract TokenFactoryTest is Test {
    TokenFactory public factory;
    address public creator = address(0xBEEF);
    address public buyer1 = address(0xCAFE);
    address public buyer2 = address(0xDEAD);

    function setUp() public {
        factory = new TokenFactory();
        vm.deal(creator, 100 ether);
        vm.deal(buyer1, 100 ether);
        vm.deal(buyer2, 100 ether);
    }

    function _token(address addr) internal pure returns (BondingCurveToken) {
        return BondingCurveToken(payable(addr));
    }

    // ── 1. Factory deploys correctly ────────────────────────────────────────

    function test_createToken() public {
        vm.prank(creator);
        address tokenAddr = factory.createToken("CurvePad Test", "CPT");

        assertNotEq(tokenAddr, address(0), "Token address must be non-zero");
        assertEq(factory.getTokenCount(), 1, "Factory should have 1 token");
        assertEq(factory.getTokens()[0], tokenAddr, "Registry mismatch");
        assertEq(factory.tokenCreator(tokenAddr), creator, "Creator mismatch");

        BondingCurveToken token = _token(tokenAddr);
        assertEq(token.name(), "CurvePad Test");
        assertEq(token.symbol(), "CPT");
        assertEq(token.creator(), creator);
        assertEq(token.totalSupply(), 0);
    }

    // ── 2. Buying returns a non-trivial token amount ─────────────────────────

    function test_buyReturnsNonTrivialTokens() public {
        vm.prank(creator);
        address tokenAddr = factory.createToken("Test", "TST");
        BondingCurveToken token = _token(tokenAddr);

        uint256 ethIn = 1 ether;
        uint256 balBefore = buyer1.balance;

        vm.prank(buyer1);
        token.buy{value: ethIn}();

        uint256 tokensBought = token.balanceOf(buyer1);
        assertGt(tokensBought, 1e15, "Should receive > 0.001 tokens");
        assertLt(tokensBought, 1_000_000e18, "Should receive < 1M tokens for 1 ETH");
        assertLt(buyer1.balance, balBefore, "ETH should have been spent");
    }

    // ── 3. Reserve integrity ─────────────────────────────────────────────────

    function test_reserveIntegrity() public {
        vm.prank(creator);
        address tokenAddr = factory.createToken("Test", "TST");
        BondingCurveToken token = _token(tokenAddr);

        vm.prank(buyer1);
        token.buy{value: 2 ether}();

        uint256 S = token.totalSupply();
        uint256 BASE_PRICE = token.BASE_PRICE();
        uint256 SLOPE = token.SLOPE();
        uint256 WAD = 1e18;

        // reserve = BASE_PRICE * (S/WAD) + SLOPE * (S/WAD)^2 / 2
        // Using integer full-token count (truncated) as the contract does.
        uint256 s = S / WAD;
        uint256 expectedReserve = BASE_PRICE * s + (SLOPE * s * s) / 2;

        uint256 actualReserve = address(token).balance;

        // Tolerance: integer truncation of sub-token fractions can cause up to
        // BASE_PRICE wei of deviation per trade. Allow 2× that.
        uint256 tolerance = BASE_PRICE * 2;
        assertApproxEqAbs(
            actualReserve,
            expectedReserve,
            tolerance,
            "Reserve must equal curve integral (within integer precision)"
        );
    }

    // ── 4. Sell round-trip ───────────────────────────────────────────────────

    function test_sellRoundTrip() public {
        vm.prank(creator);
        address tokenAddr = factory.createToken("Test", "TST");
        BondingCurveToken token = _token(tokenAddr);

        uint256 ethIn = 1 ether;
        uint256 ethBefore = buyer1.balance;

        vm.prank(buyer1);
        token.buy{value: ethIn}();

        uint256 tokensBought = token.balanceOf(buyer1);
        assertGt(tokensBought, 0, "Must have bought tokens");

        uint256 ethAfterBuy = buyer1.balance;

        vm.prank(buyer1);
        token.sell(tokensBought);

        uint256 ethAfterSell = buyer1.balance;

        assertGt(ethAfterSell, ethAfterBuy, "Should receive ETH back");
        uint256 netLoss = ethBefore - ethAfterSell;
        uint256 maxAllowedLoss = (ethIn * 5) / 100; // 5% max loss
        assertLt(netLoss, maxAllowedLoss, "Net loss should be < 5% (2x 1% fees + rounding)");
    }

    // ── 5. Price strictly increases with buys ────────────────────────────────

    function test_priceIncreasesWithBuys() public {
        vm.prank(creator);
        address tokenAddr = factory.createToken("Test", "TST");
        BondingCurveToken token = _token(tokenAddr);

        uint256 priceBefore = token.getCurrentPrice();

        vm.prank(buyer1);
        token.buy{value: 1 ether}();

        uint256 priceAfter = token.getCurrentPrice();
        assertGt(priceAfter, priceBefore, "Price must increase after buy");
    }

    // ── 6. Multiple buyers, prices ascending ─────────────────────────────────

    function test_multiplebuyers_pricesAscending() public {
        vm.prank(creator);
        address tokenAddr = factory.createToken("Test", "TST");
        BondingCurveToken token = _token(tokenAddr);

        vm.prank(buyer1);
        token.buy{value: 0.5 ether}();
        uint256 priceAfterBuyer1 = token.getCurrentPrice();

        vm.prank(buyer2);
        token.buy{value: 0.5 ether}();
        uint256 priceAfterBuyer2 = token.getCurrentPrice();

        assertGt(priceAfterBuyer2, priceAfterBuyer1, "Price must keep rising");
    }

    // ── 7. Creator receives fees ──────────────────────────────────────────────

    function test_creatorReceivesFees() public {
        vm.prank(creator);
        address tokenAddr = factory.createToken("Test", "TST");
        BondingCurveToken token = _token(tokenAddr);

        uint256 creatorBalBefore = creator.balance;

        vm.prank(buyer1);
        token.buy{value: 1 ether}();

        uint256 creatorBalAfter = creator.balance;
        assertGt(creatorBalAfter, creatorBalBefore, "Creator must receive ETH fee");

        // Fee ≈ 1% of 1 ETH = 0.01 ETH
        assertApproxEqRel(
            creatorBalAfter - creatorBalBefore,
            0.01 ether,
            0.01e18, // 1% relative tolerance
            "Creator fee should be ~1%"
        );
    }

    // ── 8. Cannot buy with zero ETH ──────────────────────────────────────────

    function test_revertsBuyWithZeroEth() public {
        vm.prank(creator);
        address tokenAddr = factory.createToken("Test", "TST");
        BondingCurveToken token = _token(tokenAddr);

        vm.prank(buyer1);
        vm.expectRevert("Send ETH to buy");
        token.buy{value: 0}();
    }

    // ── 9. Cannot sell more tokens than owned ────────────────────────────────

    function test_revertsSellMoreThanBalance() public {
        vm.prank(creator);
        address tokenAddr = factory.createToken("Test", "TST");
        BondingCurveToken token = _token(tokenAddr);

        vm.prank(buyer1);
        token.buy{value: 0.1 ether}();

        uint256 balance = token.balanceOf(buyer1);

        vm.prank(buyer1);
        vm.expectRevert("Insufficient balance");
        token.sell(balance + 1);
    }

    // ── 10. Factory can deploy multiple tokens ────────────────────────────────

    function test_factoryMultipleTokens() public {
        vm.startPrank(creator);
        factory.createToken("Alpha", "ALPHA");
        factory.createToken("Beta", "BETA");
        factory.createToken("Gamma", "GAMMA");
        vm.stopPrank();

        assertEq(factory.getTokenCount(), 3);
        assertEq(factory.getTokens().length, 3);
    }
}
