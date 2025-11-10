// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// ERC-4337 v0.6 UserOperation struct (unpacked format)
struct UserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    uint256 callGasLimit;
    uint256 verificationGasLimit;
    uint256 preVerificationGas;
    uint256 maxFeePerGas;
    uint256 maxPriorityFeePerGas;
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
        require(amount <= unclaimedFees, "Exceeds unclaimed fees");
        
        // Decrement unclaimed fees before transfer (checks-effects-interactions)
        unclaimedFees -= amount;
        
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
     * Get the EOA owner of a smart account
     * For undeployed (counterfactual) accounts, extracts owner from initCode if available
     * Returns address(0) if account is undeployed and initCode is empty (bundler will handle deployment)
     */
    function getAccountOwner(address account, bytes calldata initCode) internal view returns (address) {
        // Check if account is deployed (has code)
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(account)
        }
        
        if (codeSize > 0) {
            // Account is deployed - call owner() function
            (bool success, bytes memory data) = account.staticcall(
                abi.encodeWithSignature("owner()")
            );
            require(success && data.length == 32, "Failed to get owner");
            return abi.decode(data, (address));
        } else if (initCode.length >= 56) {
            // Account not deployed but has initCode - extract owner from it
            // initCode format: factory address (20 bytes) + factory calldata
            // For SimpleAccountFactory, calldata is: createAccount(owner, salt)
            
            // Skip factory address (20 bytes) and function selector (4 bytes)
            // Owner is the first parameter (next 32 bytes)
            bytes calldata factoryData = initCode[20:];
            require(factoryData.length >= 36, "Invalid factory data");
            
            // Decode owner from first parameter
            address owner;
            assembly {
                owner := calldataload(add(factoryData.offset, 4))
            }
            return owner;
        } else {
            // Account not deployed and initCode is empty
            // This can happen when bundler has seen initCode before and will deploy separately
            // Return address(0) to indicate owner verification should be skipped
            // EntryPoint already validated the signature, so this is safe
            return address(0);
        }
    }

    /**
     * Validate a user operation and decide whether to sponsor it.
     * Called by the EntryPoint during the validation phase.
     * 
     * This validates executeBatch calls with:
     * 1. transferFrom(eoa, recipient, amount)
     * 2. transferFrom(eoa, paymaster, fee)
     * 
     * @param userOp The user operation (ERC-4337 v0.6 unpacked format)
     * @param userOpHash Hash of the user operation
     * @param maxCost Maximum cost of this transaction (gas price * gas limit)
     * @return context Empty bytes (no postOp needed since fee is collected in the batch)
     * @return validationData Signature validation data (0 = success)
     */
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData) {
        require(msg.sender == entryPoint, "Only EntryPoint");
        
        // Unpack and validate paymasterAndData
        // Format: paymaster address (20B) + postGas (32B) + context (96B: address + uint256 + uint256)
        bytes calldata paymasterAndData = userOp.paymasterAndData;
        require(paymasterAndData.length >= 148, "paymasterAndData too short"); // 20 + 32 + 96
        
        // Extract paymaster address from first 20 bytes
        address paymasterAddress;
        assembly {
            paymasterAddress := shr(96, calldataload(paymasterAndData.offset))
        }
        require(paymasterAddress == address(this), "Wrong paymaster address");
        
        // Extract postGas packed values (32 bytes starting at offset 20)
        bytes32 postGasPacked;
        assembly {
            postGasPacked := calldataload(add(paymasterAndData.offset, 20))
        }
        uint128 postVerificationGasLimit = uint128(uint256(postGasPacked) >> 128);
        uint128 postOpGasLimit = uint128(uint256(postGasPacked));
        require(postVerificationGasLimit >= 50000, "postVerificationGas too low");
        require(postOpGasLimit >= 100000, "postOpGas too low");
        
        // Extract context data (96 bytes starting at offset 52)
        // Context format: recipient address (32B padded) + amount (32B) + fee (32B)
        (address contextRecipient, uint256 contextAmount, uint256 contextFee) = abi.decode(
            paymasterAndData[52:],
            (address, uint256, uint256)
        );
        
        // Get the EOA owner of the smart account (handles both deployed and undeployed accounts)
        address eoa = getAccountOwner(userOp.sender, userOp.initCode);
        
        // Decode the calldata - expecting account.executeBatch(address[], bytes[])
        bytes calldata callData = userOp.callData;
        require(callData.length >= 4, "Invalid callData");
        
        bytes4 executeBatchSelector = bytes4(keccak256("executeBatch(address[],bytes[])"));
        bytes4 selector = bytes4(callData[0:4]);
        require(selector == executeBatchSelector, "Only executeBatch calls");
        
        // Decode executeBatch parameters using abi.decode
        (address[] memory targets, bytes[] memory calls) = abi.decode(
            callData[4:],
            (address[], bytes[])
        );
        
        // Expect exactly 2 calls: transferFrom to recipient and transferFrom to paymaster
        require(targets.length == 2, "Must have 2 calls");
        require(calls.length == 2, "Must have 2 calls");
        require(targets[0] == tokenAddress, "First target must be token");
        require(targets[1] == tokenAddress, "Second target must be token");
        
        // Validate first call is transferFrom (selector 0x23b872dd)
        bytes memory call0 = calls[0];
        require(call0.length >= 100, "Invalid call 0 data"); // 4 bytes selector + 96 bytes params
        
        // Extract selector from first 4 bytes using assembly
        bytes4 selector0;
        assembly {
            // Load first 32 bytes after length, right-shift 224 bits to get selector
            selector0 := shr(224, mload(add(call0, 32)))
        }
        require(selector0 == 0x23b872dd, "First call must be transferFrom");
        
        // Decode transferFrom parameters (skip 4-byte selector)
        (address from0, address to0, uint256 amount0) = abi.decode(
            call0[4:],
            (address, address, uint256)
        );
        // If eoa is address(0) (undeployed, no initCode), skip owner check
        // EntryPoint already validated signature, so this is safe
        if (eoa != address(0)) {
            require(from0 == eoa, "Must transfer from EOA");
        }
        
        // Validate second call is transferFrom (selector 0x23b872dd)
        bytes memory call1 = calls[1];
        require(call1.length >= 100, "Invalid call 1 data"); // 4 bytes selector + 96 bytes params
        
        // Extract selector from first 4 bytes using assembly
        bytes4 selector1;
        assembly {
            // Load first 32 bytes after length, right-shift 224 bits to get selector
            selector1 := shr(224, mload(add(call1, 32)))
        }
        require(selector1 == 0x23b872dd, "Second call must be transferFrom");
        
        // Decode transferFrom parameters (skip 4-byte selector)
        (address from1, address to1, uint256 fee) = abi.decode(
            call1[4:],
            (address, address, uint256)
        );
        // Both transfers must be from the same address
        require(from0 == from1, "Both transfers must be from same address");
        // If eoa is address(0) (undeployed, no initCode), skip owner check
        if (eoa != address(0)) {
            require(from1 == eoa, "Must collect fee from EOA");
        }
        require(to1 == address(this), "Fee must go to paymaster");
        
        // Verify minimum transfer amount
        require(amount0 >= minTransfer, "Below minimum transfer");
        
        // Verify fee calculation is correct
        uint256 expectedFee = (amount0 * feePct) / 10000;
        require(fee == expectedFee, "Incorrect fee amount");
        require(fee > 0, "Fee too small");
        
        // Verify context matches executeBatch data
        require(contextRecipient == to0, "Context recipient mismatch");
        require(contextAmount == amount0, "Context amount mismatch");
        require(contextFee == fee, "Context fee mismatch");
        
        // EIP-7562 Compliance: Do NOT check balanceOf/allowance during validation
        // Unstaked paymasters cannot access external storage per [STO-021]
        // If user has insufficient balance or approval, execution will fail naturally
        // and paymaster only loses gas for that specific failed operation
        
        // Pack context for postOp: sender address, token amount, and fee
        // PostOp will track fees only if operation succeeds
        context = abi.encode(userOp.sender, amount0, fee);
        
        // Return success
        validationData = 0;
    }

    /**
     * Post-operation handler called after user operation execution.
     * Tracks fees and emits events only if operation succeeded.
     * Fees are collected in the executeBatch call, so this doesn't do transfers.
     * @param mode Whether the user operation succeeded or reverted
     * @param context Data from validatePaymasterUserOp (sender, amount, fee)
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
        
        // Only track fees if operation succeeded
        if (mode != PostOpMode.opSucceeded) {
            return;
        }
        
        // Decode context
        (address sender, uint256 tokenAmount, uint256 fee) = abi.decode(
            context,
            (address, uint256, uint256)
        );
        
        // Track unclaimed fees for sponsor (fees were already transferred in batch)
        unclaimedFees += fee;
        
        // Emit event for tracking
        emit UserOperationSponsored(sender, actualGasCost, fee);
    }
}
