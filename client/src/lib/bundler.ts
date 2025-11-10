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
   */
  private serializeUserOp(userOp: PackedUserOperation): Record<string, string> {
    return {
      sender: userOp.sender,
      nonce: `0x${userOp.nonce.toString(16)}`,
      initCode: userOp.initCode,
      callData: userOp.callData,
      accountGasLimits: userOp.accountGasLimits,
      preVerificationGas: `0x${userOp.preVerificationGas.toString(16)}`,
      gasFees: userOp.gasFees,
      paymasterAndData: userOp.paymasterAndData,
      signature: userOp.signature,
    };
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
