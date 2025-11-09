import { type Pool, type InsertPool, type Transaction, type InsertTransaction, pools, transactions } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

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
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;
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
}

export const storage = new DatabaseStorage();
