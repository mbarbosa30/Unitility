// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits;
    uint256 preVerificationGas;
    bytes32 gasFees;
    bytes paymasterAndData;
    bytes signature;
}

interface IEntryPoint {
    function depositTo(address account) external payable;
}

enum PostOpMode {
    opSucceeded,
    opReverted,
    postOpReverted
}

contract PaymasterPool {
    address public immutable entryPoint;
    address public immutable tokenAddress;
    uint256 public feePct;
    uint256 public minTransfer;
    address public sponsor;
    uint256 public unclaimedFees;

    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event FeesClaimed(address indexed sponsor, uint256 amount);
    event UserOperationSponsored(address indexed sender, uint256 actualGasCost, uint256 tokenFee);

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

    /**
     * Validate a user operation and decide whether to sponsor it.
     * Called by the EntryPoint during the validation phase.
     * @param userOp The packed user operation (ERC-4337 v0.7 format)
     * @param userOpHash Hash of the user operation
     * @param maxCost Maximum cost of this transaction (gas price * gas limit)
     * @return context Data to pass to postOp (contains sender and token amount)
     * @return validationData Signature validation data (0 = success)
     */
    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData) {
        require(msg.sender == entryPoint, "Only EntryPoint");
        
        // Decode the calldata to extract token transfer amount
        // Expected format: transfer(address to, uint256 amount)
        bytes calldata callData = userOp.callData;
        require(callData.length >= 68, "Invalid callData");
        
        // Extract function selector and amount from callData
        bytes4 selector = bytes4(callData[0:4]);
        require(selector == IERC20.transfer.selector, "Only token transfers");
        
        // Extract token amount (uint256 at bytes 36-68)
        uint256 tokenAmount;
        assembly {
            tokenAmount := calldataload(add(callData.offset, 36))
        }
        
        // Verify minimum transfer amount
        require(tokenAmount >= minTransfer, "Below minimum transfer");
        
        // Calculate fee in tokens (feePct is in basis points, e.g., 50 = 0.5%)
        uint256 tokenFee = (tokenAmount * feePct) / 10000;
        require(tokenFee > 0, "Fee too small");
        
        // Verify user has sufficient token balance (including fee)
        uint256 requiredBalance = tokenAmount + tokenFee;
        require(
            IERC20(tokenAddress).balanceOf(userOp.sender) >= requiredBalance,
            "Insufficient token balance"
        );
        
        // Pack context for postOp: sender address and token fee amount
        context = abi.encode(userOp.sender, tokenFee);
        
        // Return success (validationData = 0 means no time limits, no authorizer)
        validationData = 0;
    }

    /**
     * Post-operation handler called after user operation execution.
     * Collects the fee in tokens from the user.
     * @param mode Whether the user operation succeeded or reverted
     * @param context Data from validatePaymasterUserOp
     * @param actualGasCost Actual gas used (in wei)
     * @param actualUserOpFeePerGas Effective gas price
     */
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) external {
        require(msg.sender == entryPoint, "Only EntryPoint");
        
        // Only collect fees if operation succeeded or reverted (not if postOp reverted)
        if (mode == PostOpMode.postOpReverted) {
            return;
        }
        
        // Decode context
        (address sender, uint256 tokenFee) = abi.decode(context, (address, uint256));
        
        // Collect fee in tokens from the user
        bool success = IERC20(tokenAddress).transferFrom(sender, address(this), tokenFee);
        require(success, "Fee collection failed");
        
        // Track unclaimed fees for sponsor
        unclaimedFees += tokenFee;
        
        emit UserOperationSponsored(sender, actualGasCost, tokenFee);
    }
}
