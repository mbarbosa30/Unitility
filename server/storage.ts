import { type Pool, type InsertPool, type Transaction, type InsertTransaction, pools, transactions } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Pool operations
  getAllPools(): Promise<Pool[]>;
  getPool(id: string): Promise<Pool | undefined>;
  createPool(pool: InsertPool): Promise<Pool>;
  updatePool(id: string, pool: Partial<InsertPool>): Promise<Pool | undefined>;
  
  // Transaction operations
  getAllTransactions(): Promise<Transaction[]>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
}

export class DatabaseStorage implements IStorage {
  async getAllPools(): Promise<Pool[]> {
    return await db.select().from(pools);
  }

  async getPool(id: string): Promise<Pool | undefined> {
    const result = await db.select().from(pools).where(eq(pools.id, id));
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

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const result = await db.insert(transactions).values(insertTransaction).returning();
    return result[0];
  }
}

export const storage = new DatabaseStorage();
