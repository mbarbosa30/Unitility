import { type Pool, type InsertPool, type Transaction, type InsertTransaction, pools, transactions } from "@shared/schema";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";

export interface TokenAnalytics {
  tokenSymbol: string;
  totalEthBurned: string; // Total ETH spent on gas for all transfers
  totalTokensAccrued: string; // Total tokens earned as fees by sponsors
  totalTransfers: number;
  avgTransferAmount: string;
  avgFeePercentage: string; // Weighted average fee across all pools
  impliedPriceInETH: string; // ETH burned / tokens accrued
  intendedFDV: string | null; // implied price × total supply (if available)
}

export interface IStorage {
  // Pool operations
  getAllPools(): Promise<Pool[]>;
  getPool(id: string): Promise<Pool | undefined>;
  getPoolByContractAddress(contractAddress: string): Promise<Pool | undefined>;
  getPoolByTransactionHash(transactionHash: string): Promise<Pool | undefined>;
  createPool(pool: InsertPool): Promise<Pool>;
  updatePool(id: string, pool: Partial<InsertPool>): Promise<Pool | undefined>;
  deletePool(id: string): Promise<void>;
  
  // Transaction operations
  getAllTransactions(): Promise<Transaction[]>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactionsByPoolId(poolId: string): Promise<Transaction[]>;
  getTransactionByHash(transactionHash: string): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;
  
  // Analytics operations
  getTokenAnalytics(tokenSymbol?: string): Promise<TokenAnalytics[]>;
}

export class DatabaseStorage implements IStorage {
  async getAllPools(): Promise<Pool[]> {
    return await db.select().from(pools);
  }

  async getPool(id: string): Promise<Pool | undefined> {
    const result = await db.select().from(pools).where(eq(pools.id, id));
    return result[0];
  }

  async getPoolByContractAddress(contractAddress: string): Promise<Pool | undefined> {
    const result = await db.select().from(pools).where(eq(pools.contractAddress, contractAddress));
    return result[0];
  }

  async getPoolByTransactionHash(transactionHash: string): Promise<Pool | undefined> {
    const result = await db.select().from(pools).where(eq(pools.transactionHash, transactionHash));
    return result[0];
  }

  async createPool(insertPool: InsertPool): Promise<Pool> {
    const result = await db.insert(pools).values(insertPool).returning();
    return result[0];
  }

  async updatePool(id: string, poolUpdate: Partial<InsertPool>): Promise<Pool | undefined> {
    const result = await db
      .update(pools)
      .set(poolUpdate)
      .where(eq(pools.id, id))
      .returning();
    return result[0];
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return await db.select().from(transactions);
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    const result = await db.select().from(transactions).where(eq(transactions.id, id));
    return result[0];
  }

  async getTransactionsByPoolId(poolId: string): Promise<Transaction[]> {
    return await db.select().from(transactions).where(eq(transactions.poolId, poolId));
  }

  async getTransactionByHash(transactionHash: string): Promise<Transaction | undefined> {
    const result = await db.select().from(transactions).where(eq(transactions.transactionHash, transactionHash));
    return result[0];
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const result = await db.insert(transactions).values(insertTransaction).returning();
    return result[0];
  }

  async deletePool(id: string): Promise<void> {
    await db.delete(pools).where(eq(pools.id, id));
  }

  async deleteTransaction(id: string): Promise<void> {
    await db.delete(transactions).where(eq(transactions.id, id));
  }

  async getTokenAnalytics(tokenSymbol?: string): Promise<TokenAnalytics[]> {
    // Build query to calculate analytics per token
    // Cast decimal columns to numeric for aggregation operations
    const query = db
      .select({
        tokenSymbol: transactions.tokenSymbol,
        totalEthBurned: sql<string>`COALESCE(SUM(CAST(${transactions.gasCost} AS NUMERIC)), 0)::text`.as('total_eth_burned'),
        totalTokensAccrued: sql<string>`COALESCE(SUM(CAST(${transactions.fee} AS NUMERIC)), 0)::text`.as('total_tokens_accrued'),
        totalTransfers: sql<number>`COUNT(*)`.as('total_transfers'),
        avgTransferAmount: sql<string>`COALESCE(AVG(CAST(${transactions.amount} AS NUMERIC)), 0)::text`.as('avg_transfer_amount'),
      })
      .from(transactions)
      .groupBy(transactions.tokenSymbol);

    // Filter by token symbol if provided
    const results = tokenSymbol 
      ? await query.where(eq(transactions.tokenSymbol, tokenSymbol))
      : await query;

    // Calculate derived metrics and get pool data for each token
    const analytics: TokenAnalytics[] = await Promise.all(
      results.map(async (row) => {
        // Get all pools for this token to calculate weighted average fee and total supply
        const tokenPools = await db
          .select()
          .from(pools)
          .where(eq(pools.tokenSymbol, row.tokenSymbol));

        // Calculate weighted average fee (weight by volume)
        let totalVolume = 0;
        let weightedFeeSum = 0;
        let totalSupply: string | null = null;

        for (const pool of tokenPools) {
          const volume = parseFloat(pool.volume);
          const fee = parseFloat(pool.feePercentage);
          totalVolume += volume;
          weightedFeeSum += volume * fee;
          
          // Use first non-null total supply
          if (!totalSupply && pool.totalSupply) {
            totalSupply = pool.totalSupply;
          }
        }

        const avgFeePercentage = totalVolume > 0 
          ? (weightedFeeSum / totalVolume).toFixed(4)
          : "0";

        // Calculate implied price: ETH burned / tokens accrued
        const ethBurned = parseFloat(row.totalEthBurned);
        const tokensAccrued = parseFloat(row.totalTokensAccrued);
        const impliedPriceInETH = tokensAccrued > 0
          ? (ethBurned / tokensAccrued).toFixed(12)
          : "0";

        // Calculate intended FDV if total supply is available
        let intendedFDV: string | null = null;
        if (totalSupply && parseFloat(impliedPriceInETH) > 0) {
          const fdv = parseFloat(impliedPriceInETH) * parseFloat(totalSupply);
          intendedFDV = fdv.toFixed(6);
        }

        return {
          tokenSymbol: row.tokenSymbol,
          totalEthBurned: row.totalEthBurned,
          totalTokensAccrued: row.totalTokensAccrued,
          totalTransfers: row.totalTransfers,
          avgTransferAmount: row.avgTransferAmount,
          avgFeePercentage,
          impliedPriceInETH,
          intendedFDV,
        };
      })
    );

    return analytics;
  }
}

export const storage = new DatabaseStorage();
