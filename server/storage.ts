import { type Pool, type InsertPool, type Transaction, type InsertTransaction } from "@shared/schema";
import { randomUUID } from "crypto";

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

export class MemStorage implements IStorage {
  private pools: Map<string, Pool>;
  private transactions: Map<string, Transaction>;

  constructor() {
    this.pools = new Map();
    this.transactions = new Map();
    this.seedData();
  }

  private seedData() {
    // Seed with mock pool data
    const mockPools: InsertPool[] = [
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

    mockPools.forEach((pool) => {
      const id = randomUUID();
      this.pools.set(id, { ...pool, id, createdAt: new Date() });
    });
  }

  async getAllPools(): Promise<Pool[]> {
    return Array.from(this.pools.values());
  }

  async getPool(id: string): Promise<Pool | undefined> {
    return this.pools.get(id);
  }

  async createPool(insertPool: InsertPool): Promise<Pool> {
    const id = randomUUID();
    const pool: Pool = { ...insertPool, id, createdAt: new Date() };
    this.pools.set(id, pool);
    return pool;
  }

  async updatePool(id: string, poolUpdate: Partial<InsertPool>): Promise<Pool | undefined> {
    const pool = this.pools.get(id);
    if (!pool) return undefined;
    const updatedPool = { ...pool, ...poolUpdate };
    this.pools.set(id, updatedPool);
    return updatedPool;
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values());
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    return this.transactions.get(id);
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = randomUUID();
    const transaction: Transaction = { ...insertTransaction, id, timestamp: new Date() };
    this.transactions.set(id, transaction);
    return transaction;
  }
}

export const storage = new MemStorage();
