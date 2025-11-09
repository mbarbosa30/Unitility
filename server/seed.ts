import { db } from "./db";
import { pools } from "@shared/schema";

async function seed() {
  console.log("Seeding database...");

  // Check if pools already exist
  const existingPools = await db.select().from(pools);
  if (existingPools.length > 0) {
    console.log("Database already seeded. Skipping...");
    return;
  }

  // Seed with mock pool data
  const mockPools = [
    {
      tokenSymbol: "DOGGO",
      tokenName: "Doggo Token",
      tokenAddress: "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3",
      decimals: 18, // Standard ERC-20 decimals
      contractAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      sponsor: "0x1234567890123456789012345678901234567890",
      feePercentage: "0.4",
      ethDeposited: "5.2",
      feesEarned: "1240",
      volume: "2100000",
      discount: "-12.3",
      apy: "18",
      gasPrice: "0.0012",
      chainId: 8453,
      blockNumber: 12450000,
      transactionHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    },
    {
      tokenSymbol: "USDC",
      tokenName: "USD Coin",
      tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base mainnet USDC
      decimals: 6, // USDC has 6 decimals
      contractAddress: "0x851356ae760d987E095750cCeb3bC6014560891C",
      sponsor: "0x2345678901234567890123456789012345678901",
      feePercentage: "0.1",
      ethDeposited: "12.8",
      feesEarned: "8400",
      volume: "8400000",
      discount: "0.2",
      apy: "12",
      gasPrice: "0.0008",
      chainId: 8453,
      blockNumber: 12451000,
      transactionHash: "0xbcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890a",
    },
    {
      tokenSymbol: "RARE",
      tokenName: "Rare Token",
      tokenAddress: "0xFEa7a6a0B346362BF88A9e4A88416B77a57D6c2A",
      decimals: 18, // Standard ERC-20 decimals
      contractAddress: "0xd45F27E7d4F98E8c02f48F58C8A65F3E8Fc28Ae1",
      sponsor: "0x3456789012345678901234567890123456789012",
      feePercentage: "0.8",
      ethDeposited: "2.1",
      feesEarned: "89",
      volume: "89000",
      discount: "-5.1",
      apy: "4",
      gasPrice: "0.0021",
      chainId: 8453,
      blockNumber: 12449500,
      transactionHash: "0xcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
    },
  ];

  await db.insert(pools).values(mockPools);

  console.log("Database seeded successfully!");
}

seed()
  .catch((err) => {
    console.error("Error seeding database:", err);
    process.exit(1);
  })
  .then(() => {
    console.log("Seed complete");
    process.exit(0);
  });
