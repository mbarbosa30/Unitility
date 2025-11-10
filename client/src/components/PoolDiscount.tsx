import { useQuery } from "@tanstack/react-query";
import DiscountBadge from "./DiscountBadge";
import { calculatePoolDiscount } from "@/lib/poolSelection";
import { getTokenPrice } from "@/lib/priceOracle";
import type { Pool } from "@shared/schema";

interface PoolDiscountProps {
  pool: Pool;
}

/**
 * PoolDiscount component
 * Fetches real-time token prices and calculates discount for a pool
 * Uses standard reference amount (100 tokens) for consistent comparison
 */
export default function PoolDiscount({ pool }: PoolDiscountProps) {
  const { data: discount } = useQuery({
    queryKey: ['pool-discount', pool.id, pool.tokenSymbol],
    queryFn: async () => {
      try {
        const priceData = await getTokenPrice(pool.tokenSymbol);
        if (!priceData) return parseFloat(pool.discount); // Fallback to database value
        
        // Use standard amount of 100 tokens for comparison across pools
        // This provides a consistent reference point for discount calculation
        const standardAmount = "100";
        const estimatedGas = "0.001"; // ~$3-4 on Base (typical AA transaction cost)
        
        return calculatePoolDiscount(
          pool,
          priceData.priceInETH,
          standardAmount,
          estimatedGas
        );
      } catch (error) {
        console.error('Error calculating discount for', pool.tokenSymbol, error);
        return parseFloat(pool.discount); // Fallback to database value
      }
    },
    staleTime: 30000, // 30 seconds
    retry: 2,
  });

  const displayDiscount = discount !== undefined ? discount : parseFloat(pool.discount);

  return <DiscountBadge discount={displayDiscount} />;
}
