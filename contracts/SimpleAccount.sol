// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

// PackedUserOperation struct for ERC-4337 v0.7
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
    function getNonce(address sender, uint192 key) external view returns (uint256 nonce);
}

/**
 * SimpleAccount
 * Minimal ERC-4337 account implementation
 * Based on eth-infinitism/account-abstraction reference implementation
 */
contract SimpleAccount {
    address public immutable entryPoint;
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyEntryPoint() {
        require(msg.sender == entryPoint, "Only EntryPoint");
        _;
    }

    constructor(address _entryPoint) {
        entryPoint = _entryPoint;
    }

    /**
     * Initialize the account with an owner
     * Called by the factory during deployment
     */
    function initialize(address _owner) external {
        require(owner == address(0), "Already initialized");
        owner = _owner;
    }

    /**
     * Execute a transaction (called by EntryPoint)
     */
    function execute(address dest, uint256 value, bytes calldata func) external onlyEntryPoint {
        (bool success, bytes memory result) = dest.call{value: value}(func);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    /**
     * Execute a batch of transactions (called by EntryPoint)
     */
    function executeBatch(address[] calldata dest, bytes[] calldata func) external onlyEntryPoint {
        require(dest.length == func.length, "Wrong array lengths");
        for (uint256 i = 0; i < dest.length; i++) {
            (bool success, bytes memory result) = dest[i].call(func[i]);
            if (!success) {
                assembly {
                    revert(add(result, 32), mload(result))
                }
            }
        }
    }

    /**
     * Get the current nonce for this account
     */
    function getNonce() external view returns (uint256) {
        return IEntryPoint(entryPoint).getNonce(address(this), 0);
    }

    /**
     * Validate a UserOperation
     * Called by EntryPoint during validation phase per ERC-4337 spec
     * 
     * @param userOp The full user operation struct
     * @param userOpHash Hash of the user operation (from EntryPoint)
     * @param missingAccountFunds Amount of funds needed to pay for this operation
     * @return validationData 0 if signature is valid, 1 if invalid
     */
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external onlyEntryPoint returns (uint256 validationData) {
        // Recover signer from signature
        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(userOpHash);
        address signer = ECDSA.recover(hash, userOp.signature);
        
        // Verify signer is the owner
        if (signer != owner) {
            return 1; // Invalid signature - SIG_VALIDATION_FAILED
        }
        
        // Pay the EntryPoint if needed
        if (missingAccountFunds > 0) {
            (bool success,) = payable(msg.sender).call{value: missingAccountFunds}("");
            require(success, "Payment failed");
        }
        
        return 0; // Valid signature
    }

    /**
     * Allow receiving ETH
     */
    receive() external payable {}
}
