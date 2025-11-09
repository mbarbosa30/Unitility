/**
 * Valuation Calculation Utilities
 * Implements the economic oracle model for token valuation discovery
 * 
 * Key Formulas:
 * - P (Implied Price) = B / T = cumulativeGasBurned / feesEarned
 * - V (Intended FDV) = P × S = impliedPrice × totalSupply
 * - Arbitrage Signal = (V - spotFDV) / spotFDV × 100%
 */

import { parseEther, formatEther } from 'viem';
import type { Pool } from '@shared/schema';

export interface ValuationMetrics {
  impliedPrice: string;
  impliedPriceUSD: string | null;
  intendedFdv: string;
  intendedFdvUSD: string | null;
  spotPrice: string | null;
  spotFdv: string | null;
  arbitrageOpportunity: number | null;
  utilizationRate: number;
  breakdownETH: {
    cumulativeGasBurned: string;
    feesEarned: string;
    totalSupply: string | null;
  };
}

export interface TokenAggregatedMetrics {
  tokenSymbol: string;
  tokenName: string;
  totalPools: number;
  aggregateGasBurned: string;
  aggregateFeesEarned: string;
  aggregateVolume: string;
  impliedPrice: string;
  intendedFdv: string | null;
  totalSupply: string | null;
  spotPrice: string | null;
  spotFdv: string | null;
  arbitrageSignal: number | null;
}

/**
 * Calculate implied price (P = B / T)
 * @param gasBurned Cumulative ETH burned on gas
 * @param feesEarned Cumulative token fees collected
 * @returns Implied ETH per token price
 */
export function calculateImpliedPrice(gasBurned: string, feesEarned: string): string | null {
  try {
    const gasBurnedWei = parseEther(gasBurned);
    const feesEarnedWei = parseEther(feesEarned);

    if (feesEarnedWei === BigInt(0)) {
      return null; // Cannot calculate without fees
    }

    // P = B / T (using 18 decimal precision)
    const priceWei = (gasBurnedWei * parseEther('1')) / feesEarnedWei;
    return formatEther(priceWei);
  } catch (error) {
    console.error('[Valuation] Error calculating implied price:', error);
    return null;
  }
}

/**
 * Calculate intended FDV (V = P × S)
 * @param impliedPrice Implied ETH per token price
 * @param totalSupply Token total supply
 * @returns Intended fully diluted valuation in ETH
 */
export function calculateIntendedFdv(impliedPrice: string, totalSupply: string): string | null {
  try {
    const priceWei = parseEther(impliedPrice);
    const supply = BigInt(totalSupply);

    // V = P × S
    const fdvWei = (priceWei * supply) / parseEther('1');
    return formatEther(fdvWei);
  } catch (error) {
    console.error('[Valuation] Error calculating intended FDV:', error);
    return null;
  }
}

/**
 * Calculate arbitrage opportunity percentage
 * @param intendedFdv Utility-derived FDV
 * @param spotFdv Market FDV from DEX
 * @returns Percentage difference (positive = undervalued, negative = overvalued)
 */
export function calculateArbitrageOpportunity(intendedFdv: string, spotFdv: string): number | null {
  try {
    const intendedWei = parseEther(intendedFdv);
    const spotWei = parseEther(spotFdv);

    if (spotWei === BigInt(0)) {
      return null;
    }

    // Calculate percentage: (V - spot) / spot × 100
    const diffWei = intendedWei - spotWei;
    const percentageWei = (diffWei * BigInt(10000)) / spotWei; // Using basis points for precision
    return Number(percentageWei) / 100; // Convert to percentage
  } catch (error) {
    console.error('[Valuation] Error calculating arbitrage opportunity:', error);
    return null;
  }
}

/**
 * Calculate utilization rate (how much of deposited ETH has been burned)
 * @param gasBurned Cumulative ETH burned
 * @param ethDeposited Total ETH deposited in pool
 * @returns Utilization rate as percentage
 */
export function calculateUtilizationRate(gasBurned: string, ethDeposited: string): number {
  try {
    const burnedWei = parseEther(gasBurned);
    const depositedWei = parseEther(ethDeposited);

    if (depositedWei === BigInt(0)) {
      return 0;
    }

    // Utilization = (burned / deposited) × 100
    const utilizationWei = (burnedWei * BigInt(10000)) / depositedWei;
    return Number(utilizationWei) / 100;
  } catch (error) {
    console.error('[Valuation] Error calculating utilization rate:', error);
    return 0;
  }
}

/**
 * Get comprehensive valuation metrics for a pool
 * @param pool Pool data
 * @param ethPriceUSD Current ETH price in USD (optional)
 * @param spotPrice Current spot price from DEX (optional)
 * @param recomputedImpliedPrice Freshly calculated implied price (overrides pool.impliedPrice)
 * @param recomputedIntendedFdv Freshly calculated intended FDV (overrides pool.intendedFdv)
 * @returns Complete valuation metrics
 */
export function getPoolValuationMetrics(
  pool: Pool,
  ethPriceUSD?: number,
  spotPrice?: string,
  recomputedImpliedPrice?: string | null,
  recomputedIntendedFdv?: string | null
): ValuationMetrics {
  // Use recomputed values if provided, otherwise fall back to database values or calculate fresh
  const impliedPrice = recomputedImpliedPrice !== undefined
    ? (recomputedImpliedPrice || '0')
    : (pool.impliedPrice || 
        calculateImpliedPrice(pool.cumulativeGasBurned, pool.feesEarned) || 
        '0');

  const intendedFdv = recomputedIntendedFdv !== undefined
    ? (recomputedIntendedFdv || '0')
    : (pool.intendedFdv || 
        (pool.totalSupply && impliedPrice !== '0' 
          ? calculateIntendedFdv(impliedPrice, pool.totalSupply) 
          : null) || 
        '0');

  let spotFdv: string | null = null;
  if (spotPrice && pool.totalSupply) {
    spotFdv = calculateIntendedFdv(spotPrice, pool.totalSupply);
  }

  const arbitrageOpportunity = intendedFdv && spotFdv && intendedFdv !== '0' && spotFdv !== '0'
    ? calculateArbitrageOpportunity(intendedFdv, spotFdv)
    : null;

  const utilizationRate = calculateUtilizationRate(
    pool.cumulativeGasBurned,
    pool.ethDeposited
  );

  // Convert to USD if ETH price provided
  let impliedPriceUSD: string | null = null;
  let intendedFdvUSD: string | null = null;
  
  if (ethPriceUSD && impliedPrice !== '0') {
    const priceInETH = parseFloat(impliedPrice);
    impliedPriceUSD = (priceInETH * ethPriceUSD).toFixed(6);
  }
  
  if (ethPriceUSD && intendedFdv !== '0') {
    const fdvInETH = parseFloat(intendedFdv);
    intendedFdvUSD = (fdvInETH * ethPriceUSD).toFixed(2);
  }

  return {
    impliedPrice,
    impliedPriceUSD,
    intendedFdv,
    intendedFdvUSD,
    spotPrice: spotPrice || null,
    spotFdv,
    arbitrageOpportunity,
    utilizationRate,
    breakdownETH: {
      cumulativeGasBurned: pool.cumulativeGasBurned,
      feesEarned: pool.feesEarned,
      totalSupply: pool.totalSupply || null,
    },
  };
}

/**
 * Aggregate valuation metrics across all pools for a token
 * @param pools All pools for a specific token
 * @param spotPrice Current spot price from DEX (optional)
 * @returns Aggregated token valuation metrics
 */
export function aggregateTokenMetrics(
  pools: Pool[],
  spotPrice?: string
): TokenAggregatedMetrics | null {
  if (pools.length === 0) return null;

  const firstPool = pools[0];
  
  // Aggregate across all pools for this token
  let totalGasBurnedWei = BigInt(0);
  let totalFeesEarnedWei = BigInt(0);
  let totalVolumeWei = BigInt(0);

  pools.forEach((pool) => {
    totalGasBurnedWei += parseEther(pool.cumulativeGasBurned || '0');
    totalFeesEarnedWei += parseEther(pool.feesEarned || '0');
    totalVolumeWei += parseEther(pool.volume || '0');
  });

  const aggregateGasBurned = formatEther(totalGasBurnedWei);
  const aggregateFeesEarned = formatEther(totalFeesEarnedWei);
  const aggregateVolume = formatEther(totalVolumeWei);

  // Calculate aggregate implied price
  const impliedPrice = calculateImpliedPrice(aggregateGasBurned, aggregateFeesEarned) || '0';

  // Calculate intended FDV if we have total supply
  const totalSupply = firstPool.totalSupply;
  const intendedFdv = totalSupply && impliedPrice !== '0'
    ? calculateIntendedFdv(impliedPrice, totalSupply)
    : null;

  // Calculate spot FDV
  const spotFdv = spotPrice && totalSupply
    ? calculateIntendedFdv(spotPrice, totalSupply)
    : null;

  // Calculate arbitrage signal
  const arbitrageSignal = intendedFdv && spotFdv
    ? calculateArbitrageOpportunity(intendedFdv, spotFdv)
    : null;

  return {
    tokenSymbol: firstPool.tokenSymbol,
    tokenName: firstPool.tokenName,
    totalPools: pools.length,
    aggregateGasBurned,
    aggregateFeesEarned,
    aggregateVolume,
    impliedPrice,
    intendedFdv,
    totalSupply,
    spotPrice: spotPrice || null,
    spotFdv,
    arbitrageSignal,
  };
}

/**
 * Calculate breakeven APY for sponsors
 * Sponsors are earning tokens at rate P (ETH/token), if they can sell at spot price
 * @param impliedPrice Implied price sponsors are "paying" per token
 * @param spotPrice Current market spot price
 * @param timeframeYears Investment timeframe in years
 * @returns APY percentage
 */
export function calculateBreakevenAPY(
  impliedPrice: string,
  spotPrice: string,
  timeframeYears: number = 1
): number | null {
  try {
    if (timeframeYears <= 0) return null;

    const impliedWei = parseEther(impliedPrice);
    const spotWei = parseEther(spotPrice);

    if (impliedWei === BigInt(0)) return null;

    // Return = (spot / implied - 1) / timeframe × 100
    const returnWei = ((spotWei - impliedWei) * BigInt(10000)) / impliedWei;
    const apy = (Number(returnWei) / 100) / timeframeYears;
    
    return apy;
  } catch (error) {
    console.error('[Valuation] Error calculating breakeven APY:', error);
    return null;
  }
}
