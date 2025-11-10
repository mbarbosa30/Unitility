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

  /**
   * Verify pool creation with health checks
   * Ensures database state matches blockchain state and pool is healthy
   * 
   * Health threshold: 0.001 ETH = ~$3-4 at current prices
   * This covers gas for 1 typical AA transaction (userOp + paymaster validation)
   */
  private async verifyPoolCreation(poolAddress: `0x${string}`) {
    try {
      console.log('[Indexer] Verifying pool creation...');
      
      // Fetch pool from database
      const dbPool = await storage.getPoolByContractAddress(poolAddress.toLowerCase());
      if (!dbPool) {
        console.error('[Indexer] VERIFICATION FAILED: Pool not found in database');
        return;
      }
      
      // Read contract state
      const [contractFee, contractMinTransfer, contractSponsor, contractTokenAddress, ethBalance] = await Promise.all([
        this.publicClient.readContract({
          address: poolAddress,
          abi: PaymasterPoolABI.abi,
          functionName: 'feePct',
        }) as Promise<bigint>,
        this.publicClient.readContract({
          address: poolAddress,
          abi: PaymasterPoolABI.abi,
          functionName: 'minTransfer',
        }) as Promise<bigint>,
        this.publicClient.readContract({
          address: poolAddress,
          abi: PaymasterPoolABI.abi,
          functionName: 'sponsor',
        }) as Promise<`0x${string}`>,
        this.publicClient.readContract({
          address: poolAddress,
          abi: PaymasterPoolABI.abi,
          functionName: 'token',
        }) as Promise<`0x${string}`>,
        this.publicClient.getBalance({ address: poolAddress }),
      ]);
      
      // Verify database matches blockchain
      const dbFee = parseFloat(dbPool.feePercentage) * 100; // Convert back to basis points
      const contractFeeNum = Number(contractFee);
      const dbSponsor = dbPool.sponsor.toLowerCase();
      const contractSponsorLower = contractSponsor.toLowerCase();
      const dbTokenAddress = dbPool.tokenAddress.toLowerCase();
      const contractTokenAddressLower = contractTokenAddress.toLowerCase();
      const dbMinTransfer = parseUnits(dbPool.minTokensPerTransfer, dbPool.decimals);
      
      const feeMatches = Math.abs(dbFee - contractFeeNum) < 0.01;
      const sponsorMatches = dbSponsor === contractSponsorLower;
      const tokenAddressMatches = dbTokenAddress === contractTokenAddressLower;
      const minTransferMatches = dbMinTransfer === contractMinTransfer;
      
      if (!feeMatches || !sponsorMatches || !tokenAddressMatches || !minTransferMatches) {
        console.error('[Indexer] VERIFICATION FAILED: Database mismatch', {
          feeMatches,
          dbFee,
          contractFee: contractFeeNum,
          sponsorMatches,
          dbSponsor,
          contractSponsor: contractSponsorLower,
          tokenAddressMatches,
          dbTokenAddress,
          contractTokenAddress: contractTokenAddressLower,
          minTransferMatches,
          dbMinTransfer: dbMinTransfer.toString(),
          contractMinTransfer: contractMinTransfer.toString(),
        });
        return;
      }
      
      // Health checks
      const hasETH = ethBalance > BigInt(0);
      const minGasReserve = parseEther('0.001'); // Minimum 0.001 ETH for ~1 transaction (~$3-4 at current prices)
      const isHealthy = ethBalance >= minGasReserve;
      
      console.log('[Indexer] VERIFICATION PASSED:', {
        address: poolAddress,
        dataIntegrity: 'Database matches blockchain state',
        ethBalance: formatEther(ethBalance) + ' ETH',
        healthStatus: isHealthy ? 'Healthy (>=0.001 ETH)' : 'Low ETH (needs deposit)',
        sponsor: contractSponsor,
        fee: (Number(contractFee) / 100) + '%',
        minTransfer: formatUnits(contractMinTransfer, dbPool.decimals) + ' ' + dbPool.tokenSymbol,
      });
      
      if (!hasETH) {
        console.warn('[Indexer] WARNING: Pool has no ETH balance. Sponsor should deposit ETH to enable gasless transfers.');
      }
      
    } catch (error) {
      console.error('[Indexer] VERIFICATION ERROR:', error);
    }
  }

  private async handlePoolCreatedLogs(logs: any[]) {
    for (const log of logs) {
      try {
        // Handle chain reorganizations
        if (log.removed) {
          console.log('[Indexer] WARNING: PoolCreated event removed (reorg):', log.transactionHash);
          
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

        // Check for duplicate pool BEFORE mutating in-memory state
        const existingPool = await storage.getPoolByContractAddress(poolAddress.toLowerCase());
        if (existingPool) {
          console.log('[Indexer] Pool already exists, skipping duplicate creation:', {
            address: poolAddress,
            existingId: existingPool.id,
          });
          
          // Ensure pool is in watched set even if it already exists in DB
          if (!this.poolAddresses.has(poolAddress)) {
            this.poolAddresses.add(poolAddress);
            this.watchPoolEvents();
          }
          continue;
        }

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

        // Create pool in database with error handling for unique constraint violations
        const poolData = {
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
        };
        
        try {
          await storage.createPool(poolData);

          console.log('[Indexer] Pool saved to database:', {
            address: poolAddress,
            token: `${tokenSymbol} (${tokenName})`,
            sponsor,
            fee: poolData.feePercentage + '%',
            minTransfer: formatUnits(minTransfer, decimals),
            blockNumber: poolData.blockNumber,
            txHash: log.transactionHash,
          });

          // Add to watched pools only after successful creation
          this.poolAddresses.add(poolAddress);

          // Verify pool creation with health checks
          await this.verifyPoolCreation(poolAddress);

          // Restart pool event watchers with new pool
          this.watchPoolEvents();
        } catch (createError: any) {
          // Handle unique constraint violation (duplicate)
          if (createError?.code === '23505' || createError?.message?.includes('unique constraint')) {
            console.warn('[Indexer] Unique constraint violation, pool already exists (race condition):', {
              address: poolAddress,
              error: createError.message,
            });
            
            // Reconcile by reloading pool from database
            const reconciledPool = await storage.getPoolByContractAddress(poolAddress.toLowerCase());
            if (reconciledPool) {
              console.log('[Indexer] Reconciled with existing pool:', reconciledPool.id);
              
              // Ensure pool is in watched set
              if (!this.poolAddresses.has(poolAddress)) {
                this.poolAddresses.add(poolAddress);
                this.watchPoolEvents();
              }
            } else {
              console.error('[Indexer] CRITICAL: Unique constraint violation but pool not found in database');
            }
          } else {
            // Re-throw non-constraint errors
            throw createError;
          }
        }
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
