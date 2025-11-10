// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Minimal test paymaster to debug AA50 error
// This paymaster accepts ALL UserOperations without validation
// Use ONLY for debugging - NOT production!

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

contract TestPaymaster {
    address public immutable entryPoint;
    
    event Debug(string message, uint256 value);
    event ValidationCalled(address sender);
    event PostOpCalled(uint8 mode);
    
    constructor(address _entryPoint) {
        entryPoint = _entryPoint;
    }
    
    receive() external payable {}
    
    function deposit() external payable {
        require(msg.value > 0, "Must send ETH");
        IEntryPoint(entryPoint).depositTo{value: msg.value}(address(this));
    }
    
    /**
     * Minimal validation - accepts everything
     */
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 /* userOpHash */,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData) {
        require(msg.sender == entryPoint, "Only EntryPoint");
        
        emit ValidationCalled(userOp.sender);
        emit Debug("maxCost", maxCost);
        
        // Return empty context and success
        context = "";
        validationData = 0;
    }
    
    /**
     * Minimal postOp - does nothing
     */
    function postOp(
        uint8 mode,
        bytes calldata /* context */,
        uint256 /* actualGasCost */,
        uint256 /* actualUserOpFeePerGas */
    ) external {
        require(msg.sender == entryPoint, "Only EntryPoint");
        
        emit PostOpCalled(mode);
        
        // Do nothing - just return
    }
}
