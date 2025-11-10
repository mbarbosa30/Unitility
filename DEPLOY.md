# PaymasterPool Deployment Guide

## 🚀 Deploy via Remix IDE (5 minutes)

### Step 1: Open Remix
Go to https://remix.ethereum.org

### Step 2: Create PaymasterPool.sol
Create a new file and paste the complete contract (see below)

### Step 3: Compile
- Compiler version: **0.8.20**
- Enable optimization: **200 runs**
- Compile ✅

### Step 4: Deploy to Base Mainnet
1. Environment: **Injected Provider - MetaMask**
2. Connect to **Base Mainnet** (Chain ID: 8453)
3. Constructor parameters:
   ```
   _entryPoint: 0x0000000071727De22E5E9d8BAf0edAc6f37da032
   _tokenAddress: <YOUR_TOKEN_ADDRESS>
   _feePct: 50 (= 0.5%)
   _minTransfer: 1000000000000000000 (= 1 token with 18 decimals)
   _sponsor: <YOUR_EOA_ADDRESS>
   ```

### Step 5: Fund Paymaster
After deployment, call `deposit()` with value (e.g., 0.001 ETH)

### Step 6: Update Frontend
Copy the deployed contract address and update:
- Add new pool to database, OR
- Update existing pool's `contractAddress` field

---

## 📝 Complete Contract Code

Copy this entire contract into Remix:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Minimal IERC20 interface (Remix has OpenZeppelin imported)
interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

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

    function getAccountOwner(address account, bytes calldata initCode) internal view returns (address) {
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(account)
        }
        
        if (codeSize > 0) {
            (bool success, bytes memory data) = account.staticcall(
                abi.encodeWithSignature("owner()")
            );
            require(success && data.length == 32, "Failed to get owner");
            return abi.decode(data, (address));
        } else if (initCode.length >= 56) {
            bytes calldata factoryData = initCode[20:];
            require(factoryData.length >= 36, "Invalid factory data");
            
            address owner;
            assembly {
                owner := calldataload(add(factoryData.offset, 4))
            }
            return owner;
        } else {
            return address(0);
        }
    }

    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData) {
        require(msg.sender == entryPoint, "Only EntryPoint");
        
        address eoa = getAccountOwner(userOp.sender, userOp.initCode);
        
        bytes calldata callData = userOp.callData;
        require(callData.length >= 4, "Invalid callData");
        
        bytes4 executeBatchSelector = bytes4(keccak256("executeBatch(address[],bytes[])"));
        bytes4 selector = bytes4(callData[0:4]);
        require(selector == executeBatchSelector, "Only executeBatch calls");
        
        (address[] memory targets, bytes[] memory calls) = abi.decode(
            callData[4:],
            (address[], bytes[])
        );
        
        require(targets.length == 2, "Must have 2 calls");
        require(calls.length == 2, "Must have 2 calls");
        require(targets[0] == tokenAddress, "First target must be token");
        require(targets[1] == tokenAddress, "Second target must be token");
        
        bytes4 transferFromSelector = IERC20.transferFrom.selector;
        require(calls[0].length >= 4, "Invalid call 0 data");
        bytes4 call0Selector = bytes4(calls[0][0:4]);
        require(call0Selector == transferFromSelector, "Call 0 must be transferFrom");
        
        (address from0, address to0, uint256 amount0) = abi.decode(
            calls[0][4:],
            (address, address, uint256)
        );
        if (eoa != address(0)) {
            require(from0 == eoa, "Must transfer from EOA");
        }
        
        require(calls[1].length >= 4, "Invalid call 1 data");
        bytes4 call1Selector = bytes4(calls[1][0:4]);
        require(call1Selector == transferFromSelector, "Call 1 must be transferFrom");
        
        (address from1, address to1, uint256 fee) = abi.decode(
            calls[1][4:],
            (address, address, uint256)
        );
        require(from0 == from1, "Both transfers must be from same address");
        if (eoa != address(0)) {
            require(from1 == eoa, "Must collect fee from EOA");
        }
        require(to1 == address(this), "Fee must go to paymaster");
        
        address actualEoa = eoa != address(0) ? eoa : from0;
        
        require(amount0 >= minTransfer, "Below minimum transfer");
        
        uint256 expectedFee = (amount0 * feePct) / 10000;
        require(fee == expectedFee, "Incorrect fee amount");
        require(fee > 0, "Fee too small");
        
        uint256 requiredBalance = amount0 + fee;
        require(
            IERC20(tokenAddress).balanceOf(actualEoa) >= requiredBalance,
            "Insufficient EOA token balance"
        );
        
        require(
            IERC20(tokenAddress).allowance(actualEoa, userOp.sender) >= requiredBalance,
            "Insufficient token approval"
        );
        
        context = abi.encode(userOp.sender, amount0, fee);
        validationData = 0;
    }

    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) external {
        require(msg.sender == entryPoint, "Only EntryPoint");
        
        if (mode != PostOpMode.opSucceeded) {
            return;
        }
        
        (address sender, uint256 tokenAmount, uint256 fee) = abi.decode(
            context,
            (address, uint256, uint256)
        );
        
        unclaimedFees += fee;
        
        emit UserOperationSponsored(sender, actualGasCost, fee);
    }
}
```

---

## ✅ After Deployment Checklist

- [ ] Contract deployed to Base mainnet
- [ ] ETH deposited via `deposit()` function
- [ ] Contract address copied
- [ ] Pool updated in database with new contract address
- [ ] Test gasless transfer with real tokens

## 📞 Support

If deployment fails, check:
1. MetaMask is on Base Mainnet
2. You have enough ETH for gas
3. Compiler version is exactly 0.8.20
4. All constructor parameters are correct
