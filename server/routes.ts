import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  getPoolValuationMetrics,
  aggregateTokenMetrics,
  calculateImpliedPrice,
  calculateIntendedFdv,
} from "./valuation";

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

  // ==================== ECONOMIC ORACLE ENDPOINTS ====================

  /**
   * Get comprehensive valuation metrics for a specific pool
   * Returns implied price, intended FDV, arbitrage opportunities, etc.
   */
  app.get("/api/pools/:id/metrics", async (req, res) => {
    const pool = await storage.getPool(req.params.id);
    if (!pool) {
      return res.status(404).json({ error: "Pool not found" });
    }

    // Recompute metrics from raw B/T/S for resilience (as per architect)
    const recomputedImpliedPrice = calculateImpliedPrice(
      pool.cumulativeGasBurned,
      pool.feesEarned,
      pool.decimals
    );
    
    const recomputedIntendedFdv = recomputedImpliedPrice && pool.totalSupply
      ? calculateIntendedFdv(recomputedImpliedPrice, pool.totalSupply)
      : null;

    // TODO: Fetch spot price from DEX (Uniswap/Aerodrome subgraph)
    const spotPrice = null; // Placeholder for DEX integration
    
    // TODO: Get ETH price in USD (Chainlink or DEX)
    const ethPriceUSD = undefined; // Placeholder

    // Pass recomputed values to ensure correctness after chain reorgs or drift
    const metrics = getPoolValuationMetrics(
      pool, 
      ethPriceUSD, 
      spotPrice || undefined,
      recomputedImpliedPrice,
      recomputedIntendedFdv
    );

    res.json({
      poolId: pool.id,
      tokenSymbol: pool.tokenSymbol,
      tokenName: pool.tokenName,
      contractAddress: pool.contractAddress,
      metrics,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get aggregated valuation metrics for a token across all its pools
   * Useful for seeing the "market-wide" intended FDV for a token
   */
  app.get("/api/tokens/:symbol/valuation", async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const allPools = await storage.getAllPools();
    const tokenPools = allPools.filter(
      (pool) => pool.tokenSymbol.toUpperCase() === symbol
    );

    if (tokenPools.length === 0) {
      return res.status(404).json({ error: "Token not found" });
    }

    // TODO: Fetch spot price from DEX
    const spotPrice = null; // Placeholder

    const aggregated = aggregateTokenMetrics(tokenPools, spotPrice || undefined);

    if (!aggregated) {
      return res.status(500).json({ error: "Failed to aggregate metrics" });
    }

    res.json({
      ...aggregated,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get historical FDV timeline data for analytics dashboard
   * Shows how intended FDV evolved over time as gas burned and fees accrued
   */
  app.get("/api/analytics/fdv-timeline", async (req, res) => {
    const { tokenSymbol, poolId, timeframe = "30d" } = req.query;

    // TODO: Implement time-series table for historical snapshots
    // For now, return current state as a single point
    const allPools = await storage.getAllPools();
    let pools = allPools;

    if (poolId) {
      pools = allPools.filter((p) => p.id === poolId);
    } else if (tokenSymbol) {
      pools = allPools.filter(
        (p) => p.tokenSymbol.toUpperCase() === (tokenSymbol as string).toUpperCase()
      );
    }

    // Build timeline data points
    const dataPoints = pools.map((pool) => {
      const impliedPrice = calculateImpliedPrice(
        pool.cumulativeGasBurned,
        pool.feesEarned,
        pool.decimals
      );
      const intendedFdv = impliedPrice && pool.totalSupply
        ? calculateIntendedFdv(impliedPrice, pool.totalSupply)
        : null;

      return {
        timestamp: pool.createdAt?.toISOString() || new Date().toISOString(),
        poolId: pool.id,
        tokenSymbol: pool.tokenSymbol,
        cumulativeGasBurned: pool.cumulativeGasBurned,
        feesEarned: pool.feesEarned,
        impliedPrice,
        intendedFdv,
      };
    });

    res.json({
      timeframe,
      dataPoints,
      count: dataPoints.length,
    });
  });

  const httpServer = createServer(app);

  return httpServer;
}
