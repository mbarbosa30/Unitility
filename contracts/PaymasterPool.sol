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
        
        // Decode the calldata - expecting account.execute(token, 0, transfer_data)
        // SimpleAccount execute signature: execute(address,uint256,bytes)
        bytes calldata callData = userOp.callData;
        require(callData.length >= 4, "Invalid callData");
        
        // Check if this is an execute call (common pattern for ERC-4337 accounts)
        bytes4 executeSelector = bytes4(keccak256("execute(address,uint256,bytes)"));
        bytes4 selector = bytes4(callData[0:4]);
        require(selector == executeSelector, "Only execute calls");
        
        // Decode execute parameters: (address target, uint256 value, bytes data)
        require(callData.length >= 100, "CallData too short"); // 4 (selector) + 32 (target) + 32 (value) + 32 (data offset)
        
        address target;
        uint256 value;
        bytes memory innerCallData;
        
        assembly {
            // Base pointer is after selector
            let basePtr := add(callData.offset, 4)
            
            // Load target address (offset 0 from basePtr)
            target := calldataload(basePtr)
            // Load value (offset 32 from basePtr)
            value := calldataload(add(basePtr, 32))
            // Load data offset pointer (offset 64 from basePtr)
            let dataOffset := calldataload(add(basePtr, 64))
            
            // Validate dataOffset to prevent wraparound attacks
            // Must be >= 96 (3 params * 32) and within callData bounds
            if or(lt(dataOffset, 96), gt(dataOffset, sub(callData.length, 96))) {
                revert(0, 0)
            }
            // Require 32-byte alignment
            if mod(dataOffset, 32) {
                revert(0, 0)
            }
            
            // Data pointer is basePtr + dataOffset
            let dataPtr := add(basePtr, dataOffset)
            // Load actual data length from dataPtr
            let dataLength := calldataload(dataPtr)
            
            // Bounds check: ensure we're not reading beyond callData
            let dataEnd := add(add(dataPtr, 32), dataLength)
            if gt(dataEnd, add(callData.offset, callData.length)) {
                revert(0, 0)
            }
            
            // Allocate memory for innerCallData
            innerCallData := mload(0x40)
            mstore(innerCallData, dataLength)
            // Copy actual bytes from dataPtr + 32
            calldatacopy(add(innerCallData, 0x20), add(dataPtr, 0x20), dataLength)
            
            // Update free memory pointer with 32-byte alignment
            let nextPtr := and(add(add(innerCallData, 0x20), add(dataLength, 31)), not(31))
            mstore(0x40, nextPtr)
        }
        
        // Verify target is our token and value is 0
        require(target == tokenAddress, "Target must be pool token");
        require(value == 0, "Value must be 0");
        
        // Decode inner call data - should be transfer(address, uint256)
        require(innerCallData.length >= 68, "Invalid token call");
        bytes4 transferSelector = bytes4(innerCallData[0]) |
            (bytes4(innerCallData[1]) >> 8) |
            (bytes4(innerCallData[2]) >> 16) |
            (bytes4(innerCallData[3]) >> 24);
        require(transferSelector == IERC20.transfer.selector, "Must be transfer");
        
        // Extract token amount from transfer call
        uint256 tokenAmount;
        assembly {
            tokenAmount := mload(add(innerCallData, 68)) // 32 bytes for length + 4 (selector) + 32 (address)
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
