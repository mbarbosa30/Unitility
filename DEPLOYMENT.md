# Paymaster Market - Base Mainnet Deployment Guide

## Prerequisites

1. **Development Environment**:
   - Node.js 18+ installed
   - Hardhat or Foundry for Solidity compilation
   - Base ETH for deployment gas (~$20-50)

2. **Required Accounts**:
   - Alchemy account (for RPC + AA bundler)
   - WalletConnect Project ID
   - Deployment wallet with Base ETH

3. **Environment Variables**:
   ```bash
   # Blockchain
   VITE_BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY
   VITE_PAYMASTER_FACTORY_ADDRESS=<deployed_factory_address>
   VITE_WALLETCONNECT_PROJECT_ID=<your_project_id>
   
   # Backend (for deployment script)
   DEPLOYER_PRIVATE_KEY=<your_private_key>
   ```

## Step 1: Compile Contracts

The smart contracts are in `attached_assets/Pasted--solidity...txt`. 

### Option A: Using Hardhat
```bash
# In a separate directory
mkdir paymaster-contracts && cd paymaster-contracts
npm init -y
npm install --save-dev hardhat @openzeppelin/contracts @account-abstraction/contracts

# Copy contracts
mkdir contracts
# Copy PaymasterFactory and PaymasterPool from attached file

# Compile
npx hardhat compile

# ABIs will be in artifacts/contracts/
```

### Option B: Using Foundry
```bash
# In a separate directory
forge init paymaster-contracts
cd paymaster-contracts

# Copy contracts to src/
# Install dependencies
forge install OpenZeppelin/openzeppelin-contracts
forge install eth-infinitism/account-abstraction

# Compile
forge build

# ABIs will be in out/
```

## Step 2: Deploy to Base Mainnet

### Deployment Script (Hardhat example)

Create `scripts/deploy.js`:
```javascript
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", await ethers.provider.getBalance(deployer.address));

  // EntryPoint v0.7 on Base (already deployed)
  const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

  // Deploy Factory
  const PaymasterFactory = await ethers.getContractFactory("PaymasterFactory");
  const factory = await PaymasterFactory.deploy(ENTRY_POINT);
  await factory.waitForDeployment();
  
  const factoryAddress = await factory.getAddress();
  console.log("PaymasterFactory deployed to:", factoryAddress);

  // Verify on BaseScan
  console.log("Verify with:");
  console.log(`npx hardhat verify --network base ${factoryAddress} ${ENTRY_POINT}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### Run Deployment
```bash
# Configure hardhat.config.js for Base
npx hardhat run scripts/deploy.js --network base
```

## Step 3: Verify Contracts on BaseScan

```bash
npx hardhat verify --network base FACTORY_ADDRESS ENTRY_POINT_ADDRESS
```

## Step 4: Update Environment Variables

Add the deployed factory address to your Replit secrets:
```
VITE_PAYMASTER_FACTORY_ADDRESS=<your_deployed_factory_address>
```

## Step 5: Create Initial Test Pool

Using the deployed factory, create a test pool:

```javascript
// In Hardhat console or script
const factory = await ethers.getContractAt("PaymasterFactory", FACTORY_ADDRESS);

// Create USDC pool (example)
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base
const tx = await factory.createPool(
  USDC_ADDRESS,
  50,  // 0.5% fee
  ethers.parseUnits("1", 6),  // 1 USDC minimum
  { value: ethers.parseEther("0.1") }  // 0.1 ETH deposit
);
await tx.wait();

console.log("Pool created!");
```

## Step 6: Test Integration

1. **Backend Indexer**: Start listening for PoolCreated events
2. **Frontend**: Connect wallet and verify pool appears
3. **Sponsor Actions**: Test deposit/withdraw/adjustParams
4. **Gasless Sends**: Test UserOp flow (requires bundler setup)

## Costs Estimate

- **Contract Deployment**: ~$10-20 (one-time)
- **Pool Creation**: ~$2-5 per pool
- **Alchemy AA Bundler**: $200/month for production
- **RPC Calls**: Included in Alchemy plan or ~$50/month

## Security Checklist

- [ ] Contracts verified on BaseScan
- [ ] Private keys stored in Replit Secrets (never committed)
- [ ] Test all functions on testnet first (recommended)
- [ ] Multisig for factory ownership (recommended for production)
- [ ] Professional audit before significant ETH deposits (recommended)

## Next Steps

After deployment:
1. Test sponsor actions (create pool, deposit, withdraw)
2. Set up event indexer to sync blockchain → database
3. Implement ERC-4337 UserOp flow for gasless sends
4. Add monitoring and analytics
