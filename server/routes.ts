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

  // Update pool
  app.patch("/api/pools/:id", async (req, res) => {
    const pool = await storage.updatePool(req.params.id, req.body);
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

  // Create transaction
  app.post("/api/transactions", async (req, res) => {
    const transaction = await storage.createTransaction(req.body);
    res.status(201).json(transaction);
  });

  const httpServer = createServer(app);

  return httpServer;
}
