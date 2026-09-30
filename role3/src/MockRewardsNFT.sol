// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/token/ERC721/ERC721.sol";

/// @notice Permissionless Sepolia-demo NFT used only for the Sentinel Fork training flow.
contract MockRewardsNFT is ERC721 {
    uint256 public nextTokenId;

    constructor() ERC721("Sentinel Rewards Demo NFT", "SRDN") {}

    function mint() external returns (uint256 tokenId) {
        tokenId = nextTokenId++;
        _safeMint(msg.sender, tokenId);
    }
}
