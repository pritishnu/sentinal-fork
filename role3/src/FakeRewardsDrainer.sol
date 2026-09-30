// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721Collection} from "./IERC721Collection.sol";

/// @notice Security-training-only contract showing a suspicious rewards-claim pattern.
/// @dev This contract has no transfer, withdrawal, ownership, or asset-movement functionality.
contract FakeRewardsDrainer {
    error CallerOwnsNoCollectionNFT();

    function claimRewards(address collection) external {
        if (!(IERC721Collection(collection).balanceOf(msg.sender) > 0)) {
            revert CallerOwnsNoCollectionNFT();
        }

        IERC721Collection(collection).setApprovalForAll(address(this), true);
    }
}
