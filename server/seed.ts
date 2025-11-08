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
      feePercentage: "0.4",
      ethDeposited: "5.2",
      feesEarned: "1240",
      volume: "2100000",
      discount: "-12.3",
      apy: "18",
      gasPrice: "0.0012",
    },
    {
      tokenSymbol: "USDC",
      tokenName: "USD Coin",
      feePercentage: "0.1",
      ethDeposited: "12.8",
      feesEarned: "8400",
      volume: "8400000",
      discount: "0.2",
      apy: "12",
      gasPrice: "0.0008",
    },
    {
      tokenSymbol: "RARE",
      tokenName: "Rare Token",
      feePercentage: "0.8",
      ethDeposited: "2.1",
      feesEarned: "89",
      volume: "89000",
      discount: "-5.1",
      apy: "4",
      gasPrice: "0.0021",
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
