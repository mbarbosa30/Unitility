import type { Pool } from "@shared/schema";
import { getTokenPrice } from "./priceOracle";

/**
 * Pool selection and routing service
 * Implements intelligent marketplace routing based on effective fees and pool health
 */

export interface PoolSelectionParams {
  tokenSymbol: string;
  amount: string; // Amount of tokens to send
  pools: Pool[];
  estimatedGasInETH?: string; // Estimated gas cost in ETH (default: 0.001)
  tokenPriceInETH?: string; // Token price in ETH from oracle (optional, will be fetched if not provided)
}

export interface PoolWithEffectiveFee extends Pool {
  effectiveFee: number; // Total effective fee percentage
  isHealthy: boolean; // Pool has enough ETH and meets minTransfer requirement
  effectiveCostBreakdown: {
    baseFee: number; // Sponsor's fee percentage
    gasCost: number; // Gas cost as percentage of send amount
    total: number; // Total effective cost
  };
}

/**
 * Calculate effective fee for a pool
 * Formula: effectiveFee = feePct + ((estGasInETH × tokenPriceInETH) / amount) × 100
 */
function calculateEffectiveFee(
  pool: Pool,
  amount: string,
  estimatedGasInETH: string,
  tokenPriceInETH?: string
): {
  effectiveFee: number;
  breakdown: PoolWithEffectiveFee['effectiveCostBreakdown'];
} {
  const baseFee = parseFloat(pool.feePercentage);
  const amountNum = parseFloat(amount);
  const gasInETH = parseFloat(estimatedGasInETH);
  
  // If we don't have token price, assume gas cost is negligible
  // In production, this would come from an oracle (Coingecko, Uniswap TWAP, etc.)
  let gasCostPercentage = 0;
  
  if (tokenPriceInETH && amountNum > 0) {
    const tokenPrice = parseFloat(tokenPriceInETH);
    const sendValueInETH = amountNum * tokenPrice;
    
    if (sendValueInETH > 0) {
      gasCostPercentage = (gasInETH / sendValueInETH) * 100;
    }
  }
  
  const total = baseFee + gasCostPercentage;
  
  return {
    effectiveFee: total,
    breakdown: {
      baseFee,
      gasCost: gasCostPercentage,
      total,
    },
  };
}

/**
 * Check if pool is healthy enough to handle the transaction
 */
function isPoolHealthy(
  pool: Pool,
  amount: string,
  estimatedGasInETH: string
): boolean {
  const ethDeposited = parseFloat(pool.ethDeposited);
  const minTransfer = parseFloat(pool.minTokensPerTransfer);
  const amountNum = parseFloat(amount);
  const gasRequired = parseFloat(estimatedGasInETH);
  
  // Pool must have enough ETH to cover gas
  const hasEnoughETH = ethDeposited >= gasRequired;
  
  // Amount must meet minimum transfer requirement
  const meetsMinTransfer = amountNum >= minTransfer;
  
  return hasEnoughETH && meetsMinTransfer;
}

/**
 * Select the best pool for a token transfer
 * Returns pools sorted by effective fee (lowest first), filtered by health
 */
export async function selectBestPool(params: PoolSelectionParams): Promise<{
  bestPool: PoolWithEffectiveFee | null;
  allCandidates: PoolWithEffectiveFee[];
}> {
  const {
    tokenSymbol,
    amount,
    pools,
    estimatedGasInETH = "0.001", // Default: ~$3-4 gas cost on Base
    tokenPriceInETH: providedPrice,
  } = params;
  
  // Filter pools for this token
  const tokenPools = pools.filter(p => p.tokenSymbol === tokenSymbol);
  
  if (tokenPools.length === 0) {
    return { bestPool: null, allCandidates: [] };
  }
  
  // Fetch token price if not provided
  let tokenPriceInETH = providedPrice;
  if (!tokenPriceInETH) {
    try {
      const priceData = await getTokenPrice(tokenSymbol);
      tokenPriceInETH = priceData?.priceInETH;
    } catch (error) {
      console.warn(`Failed to fetch price for ${tokenSymbol}, ranking by fee% only`, error);
    }
  }
  
  // Calculate effective fees and health for each pool
  const candidates: PoolWithEffectiveFee[] = tokenPools.map(pool => {
    const { effectiveFee, breakdown } = calculateEffectiveFee(
      pool,
      amount,
      estimatedGasInETH,
      tokenPriceInETH
    );
    
    const isHealthy = isPoolHealthy(pool, amount, estimatedGasInETH);
    
    return {
      ...pool,
      effectiveFee,
      isHealthy,
      effectiveCostBreakdown: breakdown,
    };
  });
  
  // Filter to only healthy pools
  const healthyPools = candidates.filter(p => p.isHealthy);
  
  if (healthyPools.length === 0) {
    // No healthy pools - return all candidates so UI can show why they're unavailable
    return { 
      bestPool: null, 
      allCandidates: candidates.sort((a, b) => a.effectiveFee - b.effectiveFee)
    };
  }
  
  // Sort by effective fee (ascending - lowest cost first)
  const sorted = healthyPools.sort((a, b) => a.effectiveFee - b.effectiveFee);
  
  return {
    bestPool: sorted[0],
    allCandidates: sorted,
  };
}

/**
 * Calculate discount percentage from pool metrics
 * Discount represents the arbitrage opportunity from ETH/token price volatility
 * 
 * Formula from spec: Discount% = 100 × (1 - (effectivePoolPriceInETH / spotPriceInETH))
 * 
 * Where effectivePoolPrice = spotPrice × (1 + feePct) + (gasInETH / amountInTokens)
 * 
 * Positive discount means the pool offers a better rate than spot (arbitrage opportunity)
 */
export function calculatePoolDiscount(
  pool: Pool,
  spotPriceInETH: string, // Current DEX price of token in ETH (e.g., "0.002")
  amountInTokens: string, // Amount being transferred (e.g., "100")
  estimatedGasInETH: string = "0.001" // Gas cost in ETH (e.g., "0.001")
): number {
  const spot = parseFloat(spotPriceInETH);
  const feePct = parseFloat(pool.feePercentage) / 100; // Convert percentage to decimal (0.5% → 0.005)
  const gasInETH = parseFloat(estimatedGasInETH);
  const amount = parseFloat(amountInTokens);
  
  if (spot <= 0 || amount <= 0) return 0;
  
  // Calculate gas cost per token: gasInETH / amountInTokens
  // Example: 0.001 ETH gas / 100 tokens = 0.00001 ETH per token
  const gasCostPerToken = gasInETH / amount;
  
  // Effective pool price per token = spot × (1 + feePct) + gasCostPerToken
  // Example: 0.002 × (1 + 0.005) + 0.00001 = 0.002 × 1.005 + 0.00001 = 0.00201 + 0.00001 = 0.00202 ETH
  const effectivePoolPrice = spot * (1 + feePct) + gasCostPerToken;
  
  // Discount% = 100 × (1 - (effectivePoolPrice / spot))
  // Example: 100 × (1 - (0.00202 / 0.002)) = 100 × (1 - 1.01) = 100 × (-0.01) = -1%
  // (Negative discount means premium, not arbitrage opportunity)
  const discount = 100 * (1 - (effectivePoolPrice / spot));
  
  // Only return positive discounts (arbitrage opportunities)
  // Negative values mean the pool is more expensive than spot (no arb)
  return Math.max(0, discount);
}

/**
 * Get pool health status for UI display
 */
export function getPoolHealthStatus(pool: Pool, estimatedGasInETH: string = "0.001"): {
  status: 'healthy' | 'low-eth' | 'paused';
  message: string;
} {
  const ethDeposited = parseFloat(pool.ethDeposited);
  const gasRequired = parseFloat(estimatedGasInETH);
  
  if (ethDeposited >= gasRequired * 10) {
    return { status: 'healthy', message: 'Pool is well-funded' };
  }
  
  if (ethDeposited >= gasRequired) {
    return { status: 'low-eth', message: 'Pool running low on ETH' };
  }
  
  return { status: 'paused', message: 'Insufficient ETH for transactions' };
}
