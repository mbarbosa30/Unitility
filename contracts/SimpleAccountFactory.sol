// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import "./SimpleAccount.sol";

/**
 * SimpleAccountFactory
 * A factory contract for creating SimpleAccount instances
 * Based on eth-infinitism/account-abstraction reference implementation
 */
contract SimpleAccountFactory {
    SimpleAccount public immutable accountImplementation;

    constructor(address _entryPoint) {
        accountImplementation = new SimpleAccount(_entryPoint);
    }

    /**
     * Create an account, and return its address.
     * Returns the address even if the account is already deployed.
     * During UserOperation execution, this method is called only if the account is not deployed.
     * This method returns an existing account address so that entryPoint.getSenderAddress() would work even after account creation
     */
    function createAccount(address owner, uint256 salt) public returns (SimpleAccount ret) {
        address addr = getAddress(owner, salt);
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return SimpleAccount(payable(addr));
        }
        ret = SimpleAccount(payable(new ERC1967Proxy{salt: bytes32(salt)}(
            address(accountImplementation),
            abi.encodeCall(SimpleAccount.initialize, (owner))
        )));
    }

    /**
     * Calculate the counterfactual address of this account as it would be returned by createAccount()
     */
    function getAddress(address owner, uint256 salt) public view returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            salt,
            keccak256(abi.encodePacked(
                type(ERC1967Proxy).creationCode,
                abi.encode(
                    address(accountImplementation),
                    abi.encodeCall(SimpleAccount.initialize, (owner))
                )
            ))
        )))));
    }
}

// Minimal ERC1967Proxy implementation
contract ERC1967Proxy {
    address private immutable _implementation;

    constructor(address implementation, bytes memory _data) {
        _implementation = implementation;
        if (_data.length > 0) {
            (bool success,) = implementation.delegatecall(_data);
            require(success, "Initialization failed");
        }
    }

    fallback() external payable {
        address impl = _implementation;
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    receive() external payable {}
}
