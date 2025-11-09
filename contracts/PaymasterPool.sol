// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IEntryPoint {
    function depositTo(address account) external payable;
}

contract PaymasterPool {
    address public immutable entryPoint;
    address public immutable tokenAddress;
    uint256 public feePct;
    uint256 public minTransfer;
    address public sponsor;

    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event FeesClaimed(address indexed sponsor, uint256 amount);

    constructor(
        address _entryPoint,
        address _tokenAddress,
        uint256 _feePct,
        uint256 _minTransfer,
        address _sponsor
    ) {
        entryPoint = _entryPoint;
        tokenAddress = _tokenAddress;
        feePct = _feePct;
        minTransfer = _minTransfer;
        sponsor = _sponsor;
    }

    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    function deposit() external payable {
        require(msg.value > 0, "Must send ETH");
        IEntryPoint(entryPoint).depositTo{value: msg.value}(address(this));
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        require(msg.sender == sponsor, "Only sponsor");
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        emit Withdrawn(msg.sender, amount);
    }

    function claimFees(uint256 amount) external {
        require(msg.sender == sponsor, "Only sponsor");
        IERC20(tokenAddress).transfer(sponsor, amount);
        emit FeesClaimed(sponsor, amount);
    }

    function adjustParams(uint256 newFeePct, uint256 newMinTransfer) external {
        require(msg.sender == sponsor, "Only sponsor");
        require(newFeePct <= 10000, "Fee must be <= 100%");
        feePct = newFeePct;
        minTransfer = newMinTransfer;
    }
}
