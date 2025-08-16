```typescript
import { ethers, Contract, Signer, BigNumber } from 'ethers';
import { TransactionResponse, TransactionReceipt } from '@ethersproject/abstract-provider';

export interface ISmartContractConfig {
  address: string;
  abi: any[];
  provider: ethers.providers.Provider;
  signer?: Signer;
}

export class SmartContract {
  private readonly contract: Contract;
  private readonly address: string;
  private readonly signer?: Signer;
  
  constructor(config: ISmartContractConfig) {
    this.address = ethers.utils.getAddress(config.address); // Checksum address
    this.signer = config.signer;
    
    this.contract = new ethers.Contract(
      this.address,
      config.abi,
      this.signer || config.provider
    );
  }

  public async call<T>(
    method: string,
    args: any[] = [],
    options: {gasLimit?: number; value?: BigNumber} = {}
  ): Promise<T> {
    try {
      if (!this.contract[method]) {
        throw new Error(`Method ${method} not found on contract`);
      }

      const result = await this.contract[method](...args, options);
      return result as T;
      
    } catch (error) {
      throw this.handleError(error);
    }
  }

  public async send(
    method: string,
    args: any[] = [],
    options: {gasLimit?: number; value?: BigNumber} = {}
  ): Promise<TransactionReceipt> {
    try {
      if (!this.signer) {
        throw new Error('Signer required for transaction');
      }

      if (!this.contract[method]) {
        throw new Error(`Method ${method} not found on contract`);
      }

      const tx: TransactionResponse = await this.contract[method](...args, options);
      const receipt = await tx.wait();
      
      return receipt;

    } catch (error) {
      throw this.handleError(error);
    }
  }

  public async estimateGas(
    method: string,
    args: any[] = [],
    options: {value?: BigNumber} = {}
  ): Promise<BigNumber> {
    try {
      if (!this.contract[method]) {
        throw new Error(`Method ${method} not found on contract`);
      }

      const estimate = await this.contract.estimateGas[method](...args, options);
      return estimate;

    } catch (error) {
      throw this.handleError(error);
    }
  }

  public async getBalance(): Promise<BigNumber> {
    try {
      const balance = await this.contract.provider.getBalance(this.address);
      return balance;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  public getAddress(): string {
    return this.address;
  }

  private handleError(error: any): Error {
    // Handle common contract errors
    if (error.code === 'CALL_EXCEPTION') {
      return new Error(`Contract call failed: ${error.reason || 'Unknown reason'}`);
    }
    
    if (error.code === 'INSUFFICIENT_FUNDS') {
      return new Error('Insufficient funds for transaction');
    }

    if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
      return new Error('Unable to estimate gas limit');
    }

    if (error.code === 'NONCE_EXPIRED') {
      return new Error('Transaction nonce has expired');
    }

    // Return original error if unhandled
    return error;
  }
}
```