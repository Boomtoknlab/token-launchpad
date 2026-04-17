// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/TokenFactory.sol";

contract DeployTokenFactory is Script {
    function run() external returns (address factoryAddress) {
        console.log("===========================================");
        console.log("  CurvePad TokenFactory Deployment");
        console.log("  Network: Base Mainnet (chainId 8453)");
        console.log("===========================================");

        vm.startBroadcast();
        TokenFactory factory = new TokenFactory();
        factoryAddress = address(factory);
        vm.stopBroadcast();

        console.log("  TokenFactory deployed at:");
        console.log(" ", factoryAddress);
        console.log("===========================================");
    }
}
