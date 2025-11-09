/**
 * Blockchain Event Indexer
 * Listens to PaymasterFactory and PaymasterPool events on Base mainnet
 * and syncs them to the database in real-time
 */

import { createPublicClient, http, parseAbiItem, formatEther, parseEther, parseUnits, formatUnits, type Log } from 'viem';
import { base } from 'viem/chains';
import { storage } from './storage';
import PaymasterFactoryABI from '../client/src/contracts/PaymasterFactory.json';
import PaymasterPoolABI from '../client/src/contracts/PaymasterPool.json';

const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const FACTORY_ADDRESS = process.env.VITE_PAYMASTER_FACTORY_ADDRESS as `0x${string}` | undefined;

export class BlockchainIndexer {
  private publicClient;
  private isRunning = false;
  private poolAddresses: Set<string> = new Set();
  private factoryWatcher: (() => void) | null = null;
  private poolWatchers: Array<() => void> = [];

  constructor() {
    this.publicClient = createPublicClient({
      chain: base,
      transport: http(RPC_URL),
    });
  }

  async start() {
    if (this.isRunning) {
      console.log('[Indexer] Already running');
      return;
    }

    console.log('[Indexer] Starting blockchain event indexer...');

    if (!FACTORY_ADDRESS) {
      console.log('[Indexer] Factory address not configured. Skipping indexer.');
      console.log('[Indexer] Deploy contracts and set VITE_PAYMASTER_FACTORY_ADDRESS to enable.');
      return;
    }

    this.isRunning = true;

    // Load existing pools from database
    await this.loadExistingPools();

    // Watch for new pools
    this.watchFactoryEvents();

    // Watch events on existing pools
    this.watchPoolEvents();

    console.log('[Indexer] Event indexer started successfully');
  }

  private async loadExistingPools() {
    try {
      const pools = await storage.getAllPools();
      pools.forEach((pool) => {
        if (pool.contractAddress) {
          this.poolAddresses.add(pool.contractAddress);
        }
      });
      console.log(`[Indexer] Loaded ${this.poolAddresses.size} existing pools`);
    } catch (error) {
      console.error('[Indexer] Error loading existing pools:', error);
    }
  }

  private watchFactoryEvents() {
    if (!FACTORY_ADDRESS) return;

    // Watch for PoolCreated events
    this.factoryWatcher = this.publicClient.watchContractEvent({
      address: FACTORY_ADDRESS,
      abi: PaymasterFactoryABI.abi,
      eventName: 'PoolCreated',
      onLogs: (logs) => this.handlePoolCreatedLogs(logs),
      onError: (error) => console.error('[Indexer] Factory event error:', error),
    });

    console.log('[Indexer] Watching factory for PoolCreated events');
  }

  private stopPoolWatchers() {
    // Unwatch all existing pool watchers (not factory watcher)
    this.poolWatchers.forEach((unwatch) => unwatch());
    this.poolWatchers = [];
  }

  private watchPoolEvents() {
    if (this.poolAddresses.size === 0) return;

    // Stop existing pool watchers to avoid duplicates
    this.stopPoolWatchers();

    const poolAddressArray = Array.from(this.poolAddresses) as `0x${string}`[];

    // Watch Deposited events from all pools
    const unwatchDeposited = this.publicClient.watchEvent({
      address: poolAddressArray,
      event: parseAbiItem('event Deposited(address indexed from, uint256 amount)'),
      onLogs: (logs) => this.handleDepositedLogs(logs),
      onError: (error) => console.error('[Indexer] Deposited event error:', error),
    });

    // Watch Withdrawn events from all pools
    const unwatchWithdrawn = this.publicClient.watchEvent({
      address: poolAddressArray,
      event: parseAbiItem('event Withdrawn(address indexed to, uint256 amount)'),
      onLogs: (logs) => this.handleWithdrawnLogs(logs),
      onError: (error) => console.error('[Indexer] Withdrawn event error:', error),
    });

    // Watch FeesClaimed events from all pools
    const unwatchFeesClaimed = this.publicClient.watchEvent({
      address: poolAddressArray,
      event: parseAbiItem('event FeesClaimed(address indexed sponsor, uint256 amount)'),
      onLogs: (logs) => this.handleFeesClaimedLogs(logs),
      onError: (error) => console.error('[Indexer] FeesClaimed event error:', error),
    });

    // Watch UserOperationSponsored events from all pools (for gas cost tracking)
    const unwatchUserOpSponsored = this.publicClient.watchEvent({
      address: poolAddressArray,
      event: parseAbiItem('event UserOperationSponsored(address indexed sender, uint256 actualGasCost, uint256 tokenFee)'),
      onLogs: (logs) => this.handleUserOperationSponsoredLogs(logs),
      onError: (error) => console.error('[Indexer] UserOperationSponsored event error:', error),
    });

    this.poolWatchers.push(unwatchDeposited, unwatchWithdrawn, unwatchFeesClaimed, unwatchUserOpSponsored);
    console.log(`[Indexer] Watching ${this.poolAddresses.size} pools for events`);
  }

  private async handlePoolCreatedLogs(logs: any[]) {
    for (const log of logs) {
      try {
        // Handle chain reorganizations
        if (log.removed) {
          console.log('[Indexer] PoolCreated event removed (reorg):', log.transactionHash);
          
          // Remove pool and all its transactions from database
          const pool = await storage.getPoolByTransactionHash(log.transactionHash);
          if (pool && pool.contractAddress) {
            // Delete all transactions associated with this pool
            const poolTxs = await storage.getTransactionsByPoolId(pool.id);
            for (const tx of poolTxs) {
              await storage.deleteTransaction(tx.id);
            }
            console.log(`[Indexer] Reorg: Deleted ${poolTxs.length} transactions for pool:`, pool.id);
            
            // Remove from watched addresses and delete pool
            this.poolAddresses.delete(pool.contractAddress);
            await storage.deletePool(pool.id);
            
            // Stop old watchers and restart with updated pool set
            this.stopPoolWatchers();
            this.watchPoolEvents();
            
            console.log('[Indexer] Reorg: Pool removed from database:', pool.id);
          }
          continue;
        }

        const { poolAddress, tokenAddress, feePct, minTransfer, sponsor } = log.args;

        console.log('[Indexer] New pool created:', {
          poolAddress,
          tokenAddress,
          sponsor,
          tx: log.transactionHash,
        });

        // Add to watched pools
        this.poolAddresses.add(poolAddress);

        // Fetch token metadata from ERC-20 contract
        let tokenSymbol = 'TOKEN';
        let tokenName = 'Unknown Token';
        let decimals = 18; // Default to 18 if fetch fails
        
        try {
          // Fetch symbol, name, and decimals from ERC-20 contract
          const [fetchedSymbol, fetchedName, fetchedDecimals] = await Promise.all([
            this.publicClient.readContract({
              address: tokenAddress,
              abi: [{ name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }],
              functionName: 'symbol',
            }) as Promise<string>,
            this.publicClient.readContract({
              address: tokenAddress,
              abi: [{ name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }],
              functionName: 'name',
            }) as Promise<string>,
            this.publicClient.readContract({
              address: tokenAddress,
              abi: [{ name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }],
              functionName: 'decimals',
            }) as Promise<number>,
          ]);
          
          tokenSymbol = fetchedSymbol;
          tokenName = fetchedName;
          decimals = fetchedDecimals;
          
          console.log('[Indexer] Fetched token metadata:', { tokenSymbol, tokenName, decimals });
        } catch (error) {
          console.error('[Indexer] Failed to fetch token metadata, using defaults:', error);
        }

        // Create pool in database
        await storage.createPool({
          contractAddress: poolAddress.toLowerCase(),
          tokenAddress: tokenAddress.toLowerCase(),
          tokenSymbol,
          tokenName,
          decimals,
          sponsor: sponsor.toLowerCase(),
          feePercentage: (Number(feePct) / 100).toString(),
          ethDeposited: '0',
          feesEarned: '0',
          volume: '0',
          discount: '0',
          apy: '0',
          gasPrice: '0',
          chainId: base.id,
          blockNumber: Number(log.blockNumber),
          transactionHash: log.transactionHash,
        });

        console.log('[Indexer] Pool saved to database:', poolAddress);

        // Restart pool event watchers with new pool
        this.watchPoolEvents();
      } catch (error) {
        console.error('[Indexer] Error handling PoolCreated event:', error);
      }
    }
  }

  private async handleDepositedLogs(logs: any[]) {
    for (const log of logs) {
      try {
        // Handle chain reorganizations
        if (log.removed) {
          console.log('[Indexer] Deposited event removed (reorg):', log.transactionHash);
          
          // Remove transaction from database
          const tx = await storage.getTransactionByHash(log.transactionHash);
          if (tx) {
            await storage.deleteTransaction(tx.id);
            console.log('[Indexer] Reorg: Deposit transaction removed:', tx.id);
            
            // Recalculate pool balance from remaining transactions
            const poolAddress = log.address as `0x${string}`;
            const pool = await storage.getPoolByContractAddress(poolAddress.toLowerCase());
            
            if (pool) {
              // Recalculate ETH balance from remaining deposit/withdrawal transactions using bigint
              const allPoolTxs = await storage.getTransactionsByPoolId(pool.id);
              const poolTxs = allPoolTxs.filter((t) => 
                t.id !== tx.id && 
                t.tokenSymbol === 'ETH'
              );
              
              let totalWei = BigInt(0);
              for (const poolTx of poolTxs) {
                const amountWei = parseEther(poolTx.amount);
                if (poolTx.fromAddress.toLowerCase() !== poolAddress.toLowerCase()) {
                  totalWei += amountWei; // Deposit
                } else {
                  totalWei -= amountWei; // Withdrawal
                }
              }
              
              await storage.updatePool(pool.id, {
                ethDeposited: formatEther(totalWei),
              });
              
              console.log('[Indexer] Reorg: Pool balance recalculated:', pool.id);
            }
          }
          continue;
        }

        const { from, amount } = log.args;
        const poolAddress = log.address;

        console.log('[Indexer] Deposit event:', {
          pool: poolAddress,
          from,
          amount: amount.toString(),
        });

        // Find pool
        const pool = await storage.getPoolByContractAddress(poolAddress.toLowerCase());

        if (!pool) {
          console.error('[Indexer] Pool not found for deposit:', poolAddress);
          continue;
        }

        // Store event in transactions table
        await storage.createTransaction({
          fromAddress: from.toLowerCase(),
          toAddress: poolAddress.toLowerCase(),
          tokenSymbol: 'ETH',
          amount: formatEther(amount),
          fee: '0',
          poolId: pool.id,
          transactionHash: log.transactionHash,
          blockNumber: Number(log.blockNumber),
          chainId: base.id,
        });

        // Calculate new balance by adding deposit amount
        const currentBalance = parseEther(pool.ethDeposited || '0');
        const newBalance = currentBalance + amount;
        
        await storage.updatePool(pool.id, {
          ethDeposited: formatEther(newBalance),
        });

        console.log('[Indexer] Deposit persisted and pool updated');
      } catch (error) {
        console.error('[Indexer] Error handling Deposited event:', error);
      }
    }
  }

  private async handleWithdrawnLogs(logs: any[]) {
    for (const log of logs) {
      try {
        // Handle chain reorganizations
        if (log.removed) {
          console.log('[Indexer] Withdrawn event removed (reorg):', log.transactionHash);
          
          // Remove transaction from database
          const tx = await storage.getTransactionByHash(log.transactionHash);
          if (tx) {
            await storage.deleteTransaction(tx.id);
            console.log('[Indexer] Reorg: Withdrawal transaction removed:', tx.id);
            
            // Recalculate pool balance from remaining transactions
            const poolAddress = log.address as `0x${string}`;
            const pool = await storage.getPoolByContractAddress(poolAddress.toLowerCase());
            
            if (pool) {
              // Recalculate ETH balance from remaining deposit/withdrawal transactions using bigint
              const allPoolTxs = await storage.getTransactionsByPoolId(pool.id);
              const poolTxs = allPoolTxs.filter((t) => 
                t.id !== tx.id && 
                t.tokenSymbol === 'ETH'
              );
              
              let totalWei = BigInt(0);
              for (const poolTx of poolTxs) {
                const amountWei = parseEther(poolTx.amount);
                if (poolTx.fromAddress.toLowerCase() !== poolAddress.toLowerCase()) {
                  totalWei += amountWei; // Deposit
                } else {
                  totalWei -= amountWei; // Withdrawal
                }
              }
              
              await storage.updatePool(pool.id, {
                ethDeposited: formatEther(totalWei),
              });
              
              console.log('[Indexer] Reorg: Pool balance recalculated:', pool.id);
            }
          }
          continue;
        }

        const { to, amount } = log.args;
        const poolAddress = log.address;

        console.log('[Indexer] Withdrawal event:', {
          pool: poolAddress,
          to,
          amount: amount.toString(),
        });

        // Find pool
        const pool = await storage.getPoolByContractAddress(poolAddress.toLowerCase());

        if (!pool) {
          console.error('[Indexer] Pool not found for withdrawal:', poolAddress);
          continue;
        }

        // Store event in transactions table
        await storage.createTransaction({
          fromAddress: poolAddress.toLowerCase(),
          toAddress: to.toLowerCase(),
          tokenSymbol: 'ETH',
          amount: formatEther(amount),
          fee: '0',
          poolId: pool.id,
          transactionHash: log.transactionHash,
          blockNumber: Number(log.blockNumber),
          chainId: base.id,
        });

        // Calculate new balance by subtracting withdrawal amount
        const currentBalance = parseEther(pool.ethDeposited || '0');
        const newBalance = currentBalance - amount;
        
        await storage.updatePool(pool.id, {
          ethDeposited: formatEther(newBalance),
        });

        console.log('[Indexer] Withdrawal persisted and pool updated');
      } catch (error) {
        console.error('[Indexer] Error handling Withdrawn event:', error);
      }
    }
  }

  private async handleFeesClaimedLogs(logs: any[]) {
    for (const log of logs) {
      try {
        // Handle chain reorganizations
        if (log.removed) {
          console.log('[Indexer] FeesClaimed event removed (reorg):', log.transactionHash);
          
          // Remove transaction from database
          const tx = await storage.getTransactionByHash(log.transactionHash);
          if (tx) {
            await storage.deleteTransaction(tx.id);
            console.log('[Indexer] Reorg: Fee claim transaction removed:', tx.id);
            
            // Recalculate fees from remaining transactions
            const poolAddress = log.address as `0x${string}`;
            const pool = await storage.getPoolByContractAddress(poolAddress.toLowerCase());
            
            if (pool) {
              // Recalculate fees from remaining fee claim transactions using bigint
              const allPoolTxs = await storage.getTransactionsByPoolId(pool.id);
              const feeTxs = allPoolTxs.filter((t) => 
                t.id !== tx.id && 
                t.fromAddress.toLowerCase() === poolAddress.toLowerCase() &&
                t.tokenSymbol === pool.tokenSymbol
              );
              
              let totalTokenFees = BigInt(0);
              for (const feeTx of feeTxs) {
                totalTokenFees += parseEther(feeTx.amount);
              }
              
              await storage.updatePool(pool.id, {
                feesEarned: formatEther(totalTokenFees),
              });
              
              console.log('[Indexer] Reorg: Pool fees recalculated:', pool.id);
            }
          }
          continue;
        }

        const { sponsor, amount } = log.args;
        const poolAddress = log.address;

        console.log('[Indexer] Fees claimed:', {
          pool: poolAddress,
          sponsor,
          amount: amount.toString(),
        });

        // Find pool
        const pool = await storage.getPoolByContractAddress(poolAddress.toLowerCase());

        if (!pool) {
          console.error('[Indexer] Pool not found for fee claim:', poolAddress);
          continue;
        }

        // Store event in transactions table
        await storage.createTransaction({
          fromAddress: poolAddress.toLowerCase(),
          toAddress: sponsor.toLowerCase(),
          tokenSymbol: pool.tokenSymbol,
          amount: formatEther(amount),
          fee: '0',
          poolId: pool.id,
          transactionHash: log.transactionHash,
          blockNumber: Number(log.blockNumber),
          chainId: base.id,
        });

        // Update pool fees earned (cumulative) using bigint
        const currentFeesWei = parseEther(pool.feesEarned || '0');
        const totalFeesWei = currentFeesWei + amount;

        await storage.updatePool(pool.id, {
          feesEarned: formatEther(totalFeesWei),
        });

        console.log('[Indexer] Fee claim persisted and pool updated');
      } catch (error) {
        console.error('[Indexer] Error handling FeesClaimed event:', error);
      }
    }
  }

  private async handleUserOperationSponsoredLogs(logs: any[]) {
    for (const log of logs) {
      try {
        // Handle chain reorganizations
        if (log.removed) {
          console.log('[Indexer] UserOperationSponsored event removed (reorg):', log.transactionHash);
          
          // Remove transaction from database
          const tx = await storage.getTransactionByHash(log.transactionHash);
          if (tx) {
            await storage.deleteTransaction(tx.id);
            console.log('[Indexer] Reorg: Gas cost transaction removed:', tx.id);
            
            // Recalculate cumulative gas burned from remaining transactions
            const poolAddress = log.address as `0x${string}`;
            const pool = await storage.getPoolByContractAddress(poolAddress.toLowerCase());
            
            if (pool) {
              // Recalculate cumulative gas burned from remaining user op transactions using bigint
              const allPoolTxs = await storage.getTransactionsByPoolId(pool.id);
              const userOpTxs = allPoolTxs.filter((t) => 
                t.id !== tx.id && 
                t.gasCost !== null
              );
              
              let totalGasBurnedWei = BigInt(0);
              for (const userOpTx of userOpTxs) {
                totalGasBurnedWei += parseEther(userOpTx.gasCost!);
              }
              
              // Recalculate implied price and intended FDV
              const feesEarnedUnits = parseUnits(pool.feesEarned || '0', pool.decimals);
              let impliedPrice: string | undefined;
              let intendedFdv: string | undefined;
              
              if (feesEarnedUnits > BigInt(0)) {
                // P = B / T (ETH burned per token earned)
                // Gas is in ETH (18 decimals), fees in token decimals
                const priceWei = (totalGasBurnedWei * parseEther('1')) / feesEarnedUnits;
                impliedPrice = formatEther(priceWei);
                
                // V = P × S (Intended FDV = price × total supply)
                if (pool.totalSupply) {
                  const totalSupply = BigInt(pool.totalSupply);
                  const fdvWei = (priceWei * totalSupply) / parseEther('1');
                  intendedFdv = formatEther(fdvWei);
                }
              }
              
              await storage.updatePool(pool.id, {
                cumulativeGasBurned: formatEther(totalGasBurnedWei),
                impliedPrice,
                intendedFdv,
              });
              
              console.log('[Indexer] Reorg: Cumulative gas burned recalculated:', pool.id);
            }
          }
          continue;
        }

        const { sender, actualGasCost, tokenFee } = log.args;
        const poolAddress = log.address;

        console.log('[Indexer] UserOperation sponsored:', {
          pool: poolAddress,
          sender,
          gasCost: actualGasCost.toString(),
          tokenFee: tokenFee.toString(),
        });

        // Find pool
        const pool = await storage.getPoolByContractAddress(poolAddress.toLowerCase());

        if (!pool) {
          console.error('[Indexer] Pool not found for UserOperation:', poolAddress);
          continue;
        }

        // Store gasless transfer in transactions table
        await storage.createTransaction({
          fromAddress: sender.toLowerCase(),
          toAddress: sender.toLowerCase(), // For now, we don't extract the recipient from calldata
          tokenSymbol: pool.tokenSymbol,
          amount: formatUnits(tokenFee, pool.decimals), // Token amount is the fee paid
          fee: formatUnits(tokenFee, pool.decimals),
          poolId: pool.id,
          gasCost: formatEther(actualGasCost),
          transactionHash: log.transactionHash,
          blockNumber: Number(log.blockNumber),
          chainId: base.id,
        });

        // Update cumulative gas burned using bigint
        const currentGasBurnedWei = parseEther(pool.cumulativeGasBurned || '0');
        const totalGasBurnedWei = currentGasBurnedWei + actualGasCost;

        // Update fees earned using bigint (token decimals)
        const currentFeesUnits = parseUnits(pool.feesEarned || '0', pool.decimals);
        const totalFeesUnits = currentFeesUnits + tokenFee;

        // Calculate implied price: P = B / T (ETH burned per token earned)
        // Gas is in ETH (18 decimals), fees in token decimals
        let impliedPrice: string | undefined;
        let intendedFdv: string | undefined;
        
        if (totalFeesUnits > BigInt(0)) {
          const priceWei = (totalGasBurnedWei * parseEther('1')) / totalFeesUnits;
          impliedPrice = formatEther(priceWei);
          
          // Calculate intended FDV: V = P × S
          if (pool.totalSupply) {
            const totalSupply = BigInt(pool.totalSupply);
            const fdvWei = (priceWei * totalSupply) / parseEther('1');
            intendedFdv = formatEther(fdvWei);
          }
        }

        await storage.updatePool(pool.id, {
          cumulativeGasBurned: formatEther(totalGasBurnedWei),
          feesEarned: formatUnits(totalFeesUnits, pool.decimals),
          impliedPrice,
          intendedFdv,
        });

        console.log('[Indexer] UserOperation persisted, gas tracking updated');
      } catch (error) {
        console.error('[Indexer] Error handling UserOperationSponsored event:', error);
      }
    }
  }

  stop() {
    this.isRunning = false;
    
    // Unwatch factory events
    if (this.factoryWatcher) {
      this.factoryWatcher();
      this.factoryWatcher = null;
    }
    
    // Unwatch pool events
    this.poolWatchers.forEach((unwatch) => unwatch());
    this.poolWatchers = [];
    
    console.log('[Indexer] Event indexer stopped');
  }
}

// Export singleton instance
export const indexer = new BlockchainIndexer();
