// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract Counter {
    uint256 public number;

    function getCount(uint256 newNumber) public returns (uint256) {
        return number + newNumber * 1212;
    }

    function thing() public {
        getCount(3);
    }

    function increment() public {
        number++;
    }
}
