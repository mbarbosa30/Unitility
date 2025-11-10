import type { Address, Hex } from 'viem';
import type { PackedUserOperation } from './userOp';

// Bundler RPC methods (ERC-4337 standard)
interface BundlerRpcMethods {
  eth_sendUserOperation: (userOp: PackedUserOperation, entryPoint: Address) => Promise<Hex>;
  eth_getUserOperationByHash: (userOpHash: Hex) => Promise<UserOperationReceipt | null>;
  eth_getUserOperationReceipt: (userOpHash: Hex) => Promise<UserOperationReceipt | null>;
  eth_supportedEntryPoints: () => Promise<Address[]>;
}

export interface UserOperationReceipt {
  userOpHash: Hex;
  entryPoint: Address;
  sender: Address;
  nonce: bigint;
  paymaster?: Address;
  actualGasCost: bigint;
  actualGasUsed: bigint;
  success: boolean;
  reason?: string;
  logs: Array<{
    address: Address;
    topics: Hex[];
    data: Hex;
  }>;
  receipt: {
    transactionHash: Hex;
    transactionIndex: number;
    blockHash: Hex;
    blockNumber: bigint;
    from: Address;
    to: Address | null;
    cumulativeGasUsed: bigint;
    gasUsed: bigint;
    logs: Array<any>;
    logsBloom: Hex;
    status: 'success' | 'reverted';
  };
}

/**
 * Bundler RPC client for submitting UserOperations
 * 
 * This client communicates with an ERC-4337 bundler service that aggregates
 * UserOperations and submits them to the EntryPoint contract.
 * 
 * Popular bundler services:
 * - Pimlico: https://pimlico.io
 * - Stackup: https://stackup.sh
 * - Alchemy: https://alchemy.com
 */
export class BundlerClient {
  private rpcUrl: string;
  
  constructor(rpcUrl?: string) {
    // Use environment variable or fallback to placeholder
    this.rpcUrl = rpcUrl || import.meta.env.VITE_BUNDLER_RPC_URL || '';
    
    if (!this.rpcUrl) {
      console.warn(
        'VITE_BUNDLER_RPC_URL not configured. Bundler client will not work until configured.\n' +
        'Add your bundler RPC URL to Replit Secrets as VITE_BUNDLER_RPC_URL'
      );
    }
  }
  
  /**
   * Send a UserOperation to the bundler
   * @param userOp The packed user operation to submit
   * @param entryPoint The EntryPoint contract address
   * @returns The UserOperation hash
   */
  async sendUserOperation(
    userOp: PackedUserOperation,
    entryPoint: Address
  ): Promise<Hex> {
    if (!this.rpcUrl) {
      throw new Error(
        'Bundler RPC URL not configured. Add VITE_BUNDLER_RPC_URL to Replit Secrets.'
      );
    }
    
    const requestBody = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_sendUserOperation',
      params: [this.serializeUserOp(userOp), entryPoint],
    };
    
    console.log('[Bundler] Sending UserOperation:', {
      method: requestBody.method,
      entryPoint,
      rpcUrl: this.rpcUrl,
      serializedUserOp: this.serializeUserOp(userOp),
    });
    
    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    const responseText = await response.text();
    
    console.log('[Bundler] Raw response:', {
      status: response.status,
      statusText: response.statusText,
      text: responseText.substring(0, 500),
    });
    
    if (!response.ok) {
      throw new Error(`Bundler HTTP error ${response.status}: ${responseText}`);
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (err) {
      console.error('[Bundler] Failed to parse JSON:', responseText);
      throw new Error(`Bundler returned invalid JSON: ${responseText.substring(0, 500)}`);
    }
    
    if (data.error) {
      console.error('[Bundler] Error response:', data.error);
      throw new Error(`Bundler error: ${data.error.message}`);
    }
    
    console.log('[Bundler] UserOperation submitted:', data.result);
    return data.result as Hex;
  }
  
  /**
   * Get the receipt for a UserOperation
   * @param userOpHash The UserOperation hash
   * @returns The UserOperation receipt or null if not found
   */
  async getUserOperationReceipt(userOpHash: Hex): Promise<UserOperationReceipt | null> {
    if (!this.rpcUrl) {
      throw new Error(
        'Bundler RPC URL not configured. Add VITE_BUNDLER_RPC_URL to Replit Secrets.'
      );
    }
    
    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getUserOperationReceipt',
        params: [userOpHash],
      }),
    });
    
    const responseText = await response.text();
    
    if (!response.ok) {
      throw new Error(`Bundler HTTP error ${response.status}: ${responseText}`);
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (err) {
      throw new Error(`Bundler returned invalid JSON: ${responseText.substring(0, 200)}`);
    }
    
    if (data.error) {
      throw new Error(`Bundler error: ${data.error.message}`);
    }
    
    return data.result ? this.deserializeReceipt(data.result) : null;
  }
  
  /**
   * Poll for a UserOperation receipt with timeout
   * @param userOpHash The UserOperation hash
   * @param timeout Maximum time to wait in milliseconds (default: 30s)
   * @param interval Polling interval in milliseconds (default: 1s)
   * @returns The UserOperation receipt
   */
  async waitForUserOperationReceipt(
    userOpHash: Hex,
    timeout = 30000,
    interval = 1000
  ): Promise<UserOperationReceipt> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const receipt = await this.getUserOperationReceipt(userOpHash);
      
      if (receipt) {
        return receipt;
      }
      
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`UserOperation receipt not found after ${timeout}ms`);
  }
  
  /**
   * Serialize a PackedUserOperation for JSON-RPC
   * 
   * Pimlico expects unpacked gas limits in the RPC request,
   * even though v0.7 uses packed format on-chain
   */
  private serializeUserOp(userOp: PackedUserOperation): Record<string, string> {
    // Unpack accountGasLimits (packed uint128s)
    const accountGasLimits = userOp.accountGasLimits.slice(2); // Remove 0x
    const verificationGasLimit = BigInt('0x' + accountGasLimits.slice(0, 32));
    const callGasLimit = BigInt('0x' + accountGasLimits.slice(32, 64));
    
    // Unpack gasFees (packed uint128s)
    const gasFees = userOp.gasFees.slice(2); // Remove 0x
    const maxPriorityFeePerGas = BigInt('0x' + gasFees.slice(0, 32));
    const maxFeePerGas = BigInt('0x' + gasFees.slice(32, 64));
    
    // Unpack paymasterAndData
    const paymasterAndData = userOp.paymasterAndData.slice(2); // Remove 0x
    const paymaster = paymasterAndData.length >= 40 ? '0x' + paymasterAndData.slice(0, 40) : '0x';
    const paymasterVerificationGasLimit = paymasterAndData.length >= 72 ? BigInt('0x' + paymasterAndData.slice(40, 72)) : BigInt(0);
    const paymasterPostOpGasLimit = paymasterAndData.length >= 104 ? BigInt('0x' + paymasterAndData.slice(72, 104)) : BigInt(0);
    const paymasterData = paymasterAndData.length > 104 ? '0x' + paymasterAndData.slice(104) : '0x';
    
    // Unpack initCode into factory and factoryData (v0.7 RPC format)
    const initCode = userOp.initCode.slice(2); // Remove 0x
    const factory = initCode.length >= 40 ? '0x' + initCode.slice(0, 40) : undefined;
    const factoryData = initCode.length > 40 ? '0x' + initCode.slice(40) : undefined;
    
    console.log('[Bundler] Unpacking initCode:', {
      rawInitCode: userOp.initCode.substring(0, 50) + '...',
      initCodeLength: initCode.length,
      factory,
      factoryDataLength: factoryData?.length,
    });
    
    const serialized: Record<string, string> = {
      sender: userOp.sender,
      nonce: `0x${userOp.nonce.toString(16)}`,
      callData: userOp.callData,
      callGasLimit: `0x${callGasLimit.toString(16)}`,
      verificationGasLimit: `0x${verificationGasLimit.toString(16)}`,
      preVerificationGas: `0x${userOp.preVerificationGas.toString(16)}`,
      maxFeePerGas: `0x${maxFeePerGas.toString(16)}`,
      maxPriorityFeePerGas: `0x${maxPriorityFeePerGas.toString(16)}`,
      signature: userOp.signature,
    };
    
    // Only include factory/factoryData if account not deployed
    if (factory) {
      serialized.factory = factory;
      if (factoryData) {
        serialized.factoryData = factoryData;
      }
    }
    
    // Only include paymaster fields if paymaster is used
    if (paymaster !== '0x' && paymaster !== '0x0000000000000000000000000000000000000000') {
      serialized.paymaster = paymaster;
      serialized.paymasterVerificationGasLimit = `0x${paymasterVerificationGasLimit.toString(16)}`;
      serialized.paymasterPostOpGasLimit = `0x${paymasterPostOpGasLimit.toString(16)}`;
      if (paymasterData !== '0x') {
        serialized.paymasterData = paymasterData;
      }
    }
    
    return serialized;
  }
  
  /**
   * Deserialize a UserOperation receipt from JSON-RPC response
   */
  private deserializeReceipt(data: any): UserOperationReceipt {
    return {
      userOpHash: data.userOpHash,
      entryPoint: data.entryPoint,
      sender: data.sender,
      nonce: BigInt(data.nonce),
      paymaster: data.paymaster,
      actualGasCost: BigInt(data.actualGasCost),
      actualGasUsed: BigInt(data.actualGasUsed),
      success: data.success,
      reason: data.reason,
      logs: data.logs,
      receipt: {
        ...data.receipt,
        blockNumber: BigInt(data.receipt.blockNumber),
        cumulativeGasUsed: BigInt(data.receipt.cumulativeGasUsed),
        gasUsed: BigInt(data.receipt.gasUsed),
      },
    };
  }
}

// Export singleton instance
export const bundlerClient = new BundlerClient();
