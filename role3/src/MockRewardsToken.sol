// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/token/ERC20/ERC20.sol";

/// @notice Optional permissionless demo token. It is not used by FakeRewardsDrainer.
contract MockRewardsToken is ERC20 {
    constructor() ERC20("Sentinel Demo Token", "SDT") {}

    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }
}
