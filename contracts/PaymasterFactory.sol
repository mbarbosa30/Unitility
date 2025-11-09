// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PaymasterPool.sol";

contract PaymasterFactory {
    address public immutable entryPoint;
    mapping(address => address[]) public poolsByToken;
    address[] public allPools;

    event PoolCreated(
        address indexed poolAddress,
        address indexed tokenAddress,
        uint256 feePct,
        uint256 minTransfer,
        address indexed sponsor
    );

    constructor(address _entryPoint) {
        entryPoint = _entryPoint;
    }

    function createPool(
        address tokenAddress,
        uint256 feePct,
        uint256 minTransfer
    ) external payable returns (address) {
        require(feePct <= 10000, "Fee must be <= 100%");
        require(msg.value > 0, "Must deposit ETH");

        PaymasterPool pool = new PaymasterPool(
            entryPoint,
            tokenAddress,
            feePct,
            minTransfer,
            msg.sender
        );

        address poolAddress = address(pool);
        poolsByToken[tokenAddress].push(poolAddress);
        allPools.push(poolAddress);

        if (msg.value > 0) {
            (bool success, ) = poolAddress.call{value: msg.value}("");
            require(success, "ETH transfer failed");
        }

        emit PoolCreated(poolAddress, tokenAddress, feePct, minTransfer, msg.sender);
        return poolAddress;
    }

    function getPoolsByToken(address tokenAddress) external view returns (address[] memory) {
        return poolsByToken[tokenAddress];
    }

    function getAllPools() external view returns (address[] memory) {
        return allPools;
    }
}
