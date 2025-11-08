import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all pools
  app.get("/api/pools", async (_req, res) => {
    const pools = await storage.getAllPools();
    res.json(pools);
  });

  // Get single pool
  app.get("/api/pools/:id", async (req, res) => {
    const pool = await storage.getPool(req.params.id);
    if (!pool) {
      return res.status(404).json({ error: "Pool not found" });
    }
    res.json(pool);
  });

  // Create pool
  app.post("/api/pools", async (req, res) => {
    const pool = await storage.createPool(req.body);
    res.status(201).json(pool);
  });

  // Update pool (supports atomic increments)
  app.patch("/api/pools/:id", async (req, res) => {
    const { incrementVolume, incrementFees, ...updates } = req.body;
    
    // Handle atomic increments if provided
    if (incrementVolume || incrementFees) {
      const pool = await storage.getPool(req.params.id);
      if (!pool) {
        return res.status(404).json({ error: "Pool not found" });
      }
      
      if (incrementVolume) {
        updates.volume = (parseFloat(pool.volume) + parseFloat(incrementVolume)).toString();
      }
      if (incrementFees) {
        updates.feesEarned = (parseFloat(pool.feesEarned) + parseFloat(incrementFees)).toString();
      }
    }
    
    const pool = await storage.updatePool(req.params.id, updates);
    if (!pool) {
      return res.status(404).json({ error: "Pool not found" });
    }
    res.json(pool);
  });

  // Get all transactions
  app.get("/api/transactions", async (_req, res) => {
    const transactions = await storage.getAllTransactions();
    res.json(transactions);
  });

  // Create transaction (also updates pool atomically)
  app.post("/api/transactions", async (req, res) => {
    const { poolId, fee, amount, ...transactionData } = req.body;
    
    // Create transaction
    const transaction = await storage.createTransaction({
      ...transactionData,
      poolId,
      fee,
      amount,
    });
    
    // Atomically update pool volume and fees server-side
    const pool = await storage.getPool(poolId);
    if (pool) {
      // Parse the original amount from request (before fee was deducted)
      const totalAmount = parseFloat(amount) + parseFloat(fee);
      const newVolume = (parseFloat(pool.volume) + totalAmount).toString();
      const newFees = (parseFloat(pool.feesEarned) + parseFloat(fee)).toString();
      
      await storage.updatePool(poolId, {
        volume: newVolume,
        feesEarned: newFees,
      });
    }
    
    res.status(201).json(transaction);
  });

  const httpServer = createServer(app);

  return httpServer;
}
