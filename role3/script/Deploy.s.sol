// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {FakeRewardsDrainer} from "../src/FakeRewardsDrainer.sol";
import {MockRewardsNFT} from "../src/MockRewardsNFT.sol";
import {MockRewardsToken} from "../src/MockRewardsToken.sol";

/// @notice Sepolia-only deployment script. It cannot broadcast on any other chain.
contract Deploy is Script {
    uint256 internal constant SEPOLIA_CHAIN_ID = 11155111;

    function run()
        external
        returns (MockRewardsNFT nft, MockRewardsToken token, FakeRewardsDrainer drainer)
    {
        require(block.chainid == SEPOLIA_CHAIN_ID, "Sepolia only");

        vm.startBroadcast();
        nft = new MockRewardsNFT();
        token = new MockRewardsToken();
        drainer = new FakeRewardsDrainer();
        vm.stopBroadcast();

        console2.log("MockRewardsNFT:", address(nft));
        console2.log("MockRewardsToken:", address(token));
        console2.log("FakeRewardsDrainer:", address(drainer));
        console2.log("claimRewards(address) selector:");
        console2.logBytes4(FakeRewardsDrainer.claimRewards.selector);
    }
}
