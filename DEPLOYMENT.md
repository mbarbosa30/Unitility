# Paymaster Market - Base Mainnet Deployment Guide

This guide walks you through compiling and deploying the Paymaster Market smart contracts to Base mainnet.

## 🎯 Overview

The Paymaster Market uses two contracts:
- **PaymasterFactory** - Deploys new pools and manages the registry
- **PaymasterPool** - Individual pool contract for each token

## 📋 Prerequisites

1. **Hardhat or Foundry** installed locally
2. **Base ETH** (0.02+ ETH recommended for deployment)
3. **Private key** for deployment wallet
4. **Base RPC URL** (free from Alchemy, Infura, or public endpoint)

## 🔧 Step 1: Set Up Local Hardhat Project

Create a new directory for contract compilation:

```bash
mkdir paymaster-contracts && cd paymaster-contracts
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npx hardhat init
```

Select "Create a TypeScript project" when prompted.

## 📝 Step 2: Write the Solidity Contracts

Create `contracts/PaymasterFactory.sol`:

```solidity
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
```

Create `contracts/PaymasterPool.sol`:

```solidity
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
```

## 📦 Step 3: Install OpenZeppelin

```bash
npm install @openzeppelin/contracts
```

## ⚙️ Step 4: Configure Hardhat

Update `hardhat.config.ts`:

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    base: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 8453,
    },
  },
  etherscan: {
    apiKey: {
      base: process.env.BASESCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
    ],
  },
};

export default config;
```

## 🔨 Step 5: Compile Contracts

```bash
npx hardhat compile
```

This creates:
- `artifacts/contracts/PaymasterFactory.sol/PaymasterFactory.json`
- `artifacts/contracts/PaymasterPool.sol/PaymasterPool.json`

## 📤 Step 6: Extract Bytecode

Open `artifacts/contracts/PaymasterFactory.sol/PaymasterFactory.json` and copy the `bytecode` field. It starts with `0x608060405234801561...`

## 🔐 Step 7: Configure Replit Secrets

In Replit, go to **Tools → Secrets** and add:

```
DEPLOYER_PRIVATE_KEY=your_private_key_without_0x
BASE_RPC_URL=https://mainnet.base.org
PAYMASTER_FACTORY_BYTECODE=0x608060405234801561... (full bytecode from Step 6)
```

**⚠️ WARNING**: Never commit private keys to git. Always use Replit Secrets.

## 🚀 Step 8: Deploy PaymasterFactory

Back in your Replit project:

```bash
tsx scripts/deploy.ts
```

This will:
1. Check your deployer balance (needs 0.02+ ETH)
2. Prompt for confirmation (type "yes")
3. Deploy PaymasterFactory to Base mainnet
4. Display the contract address

**Example output:**
```
🚀 Paymaster Market Deployment Script
=====================================

📍 Deployer Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4
💰 Balance: 0.05 ETH
🌐 Network: Base Mainnet
🔗 EntryPoint: 0x0000000071727De22E5E9d8BAf0edAc6f37da032

⚠️  Deploy to MAINNET? This will cost real ETH. Type "yes" to continue: yes

⏳ Deploying PaymasterFactory...
📝 Transaction: 0xabcd1234...
⏳ Waiting for confirmation...

✅ PaymasterFactory deployed successfully!
📍 Factory Address: 0x1234567890abcdef...
🔗 View on BaseScan: https://basescan.org/address/0x1234567890abcdef...

💾 Add to Replit Secrets:
   VITE_PAYMASTER_FACTORY_ADDRESS=0x1234567890abcdef...
```

**Save the factory address** - you'll need it for the next step.

## 🏊 Step 9: Create Initial Test Pool

Add the factory address to Secrets:

```
VITE_PAYMASTER_FACTORY_ADDRESS=0x... (from Step 8)
```

Restart the Replit app to load the new env var.

Create a USDC pool:

```bash
tsx scripts/create-pool.ts 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 50 1000000 0.1
```

**Parameters:**
- Token: USDC on Base (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
- Fee: 0.5% (50 basis points)
- Min transfer: 1 USDC (1,000,000 with 6 decimals)
- Initial deposit: 0.1 ETH

**Example output:**
```
🏊 Creating Paymaster Pool
==========================

📍 Factory: 0x1234567890abcdef...
🪙 Token: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
💸 Fee: 0.5%
📊 Min Transfer: 1000000 units
💰 ETH Deposit: 0.1 ETH

⏳ Submitting transaction...
📝 Transaction: 0xef123456...
⏳ Waiting for confirmation...
✅ Pool created successfully!
🔗 View on BaseScan: https://basescan.org/tx/0xef123456...

🏊 Pool Address: 0xabcdef123456...
🔗 View Pool: https://basescan.org/address/0xabcdef123456...
```

## ✅ Step 10: Verify on BaseScan

Get a BaseScan API key from https://basescan.org/apis

Add to Secrets:
```
BASESCAN_API_KEY=your_api_key
```

In your Hardhat project:

```bash
npx hardhat verify --network base <FACTORY_ADDRESS> 0x0000000071727De22E5E9d8BAf0edAc6f37da032
```

## 🎉 Step 11: Verify Indexer

Restart your Replit app. Check the server logs:

```
[Indexer] Starting blockchain event indexer...
[Indexer] Watching factory at 0x1234567890abcdef...
[Indexer] Watching factory for PoolCreated events
[Indexer] New pool created: { poolAddress: '0xabcdef...', tokenAddress: '0x833589...', ... }
[Indexer] Watching 1 pool(s) for events
```

Query the API to see synced pools:

```bash
curl http://localhost:5000/api/pools
```

You should see your newly created pool with full blockchain metadata (contractAddress, blockNumber, transactionHash, etc.)!

## 📚 Common Token Addresses on Base

- **USDC**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **WETH**: `0x4200000000000000000000000000000000000006`
- **cbBTC**: `0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf`
- **DAI**: `0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb`

## 🔍 Troubleshooting

**"Insufficient balance"**: 
- Need at least 0.02 ETH for deployment
- Bridge ETH to Base using bridge.base.org

**"PAYMASTER_FACTORY_BYTECODE not set"**: 
- Make sure you compiled contracts and extracted bytecode
- Bytecode should start with `0x608060405...`
- Add full bytecode (very long string) to Replit Secrets

**"Invalid bytecode"**: 
- Ensure bytecode starts with `0x`
- Copy entire bytecode field from compiled artifacts

**"Transaction failed"**: 
- Check deployer has enough ETH
- Verify RPC URL is correct
- Try increasing gas limit

**"Indexer not starting"**: 
- Verify `VITE_PAYMASTER_FACTORY_ADDRESS` is set correctly
- Must restart app after adding env vars
- Check factory address is valid (starts with 0x, 42 chars)

**"Pool not syncing to database"**:
- Check indexer logs for errors
- Verify transaction was successful on BaseScan
- Wait a few blocks for confirmation

## 💰 Costs Estimate

- **Factory Deployment**: ~0.005-0.01 ETH (~$10-20)
- **Pool Creation**: ~0.002-0.005 ETH (~$4-10) per pool
- **Transaction Gas**: ~$0.10-0.50 per transaction on Base
- **Total for Setup**: ~$15-30 for factory + 1 test pool

## 🔐 Security Checklist

- [x] Private keys stored in Replit Secrets (never committed)
- [ ] Contracts verified on BaseScan (improves transparency)
- [ ] Test all functions on testnet first (optional but recommended)
- [ ] Start with small ETH deposits (test with $10-50 first)
- [ ] Monitor pool activity regularly
- [ ] Consider multisig for production (recommended for large deposits)

## 🎯 Next Steps

After successful deployment:
1. ✅ Factory deployed and verified
2. ✅ Test pool created (USDC)
3. ✅ Indexer syncing events to database
4. 🔜 Build sponsor UI for pool management (Task 7)
5. 🔜 Implement gasless send flow (Task 9)
6. 🔜 Add rebalancer interface (Task 10)

---

**Need help?** Check the deployment logs in the Replit console or review the contract on BaseScan at https://basescan.org
