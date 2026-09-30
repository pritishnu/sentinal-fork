// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC721Collection {
    function balanceOf(address owner) external view returns (uint256);
    function setApprovalForAll(address operator, bool approved) external;
}
