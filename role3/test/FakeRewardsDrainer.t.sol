// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {FakeRewardsDrainer} from "../src/FakeRewardsDrainer.sol";
import {MockRewardsNFT} from "../src/MockRewardsNFT.sol";

contract FakeRewardsDrainerTest is Test {
    FakeRewardsDrainer internal drainer;
    MockRewardsNFT internal nft;
    address internal alice;
    address internal nonHolder;

    function setUp() external {
        drainer = new FakeRewardsDrainer();
        nft = new MockRewardsNFT();
        alice = makeAddr("alice");
        nonHolder = makeAddr("nonHolder");
        vm.prank(alice);
        uint256 tokenId = nft.mint();
        assertEq(nft.ownerOf(tokenId), alice);
    }

    function testOwnerCanClaimRewards() external {
        vm.prank(alice);
        drainer.claimRewards(address(nft));
    }

    function testClaimEmitsApprovalForAllForDrainerOperator() external {
        vm.recordLogs();
        vm.prank(alice);
        drainer.claimRewards(address(nft));

        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1);
        assertEq(logs[0].emitter, address(nft));
        assertEq(logs[0].topics[0], keccak256("ApprovalForAll(address,address,bool)"));
        assertEq(address(uint160(uint256(logs[0].topics[1]))), address(drainer));
        assertEq(address(uint160(uint256(logs[0].topics[2]))), address(drainer));
        assertTrue(abi.decode(logs[0].data, (bool)));

        assertTrue(nft.isApprovedForAll(address(drainer), address(drainer)));
        assertFalse(nft.isApprovedForAll(alice, address(drainer)));
    }

    function testNonHolderCannotClaimRewards() external {
        vm.expectRevert(FakeRewardsDrainer.CallerOwnsNoCollectionNFT.selector);
        vm.prank(nonHolder);
        drainer.claimRewards(address(nft));
    }
}
