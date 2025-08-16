```typescript
import { Wallet, Contract, providers, utils } from 'ethers';
import { AxiosInstance, AxiosResponse } from 'axios';
import { createHash, randomBytes } from 'crypto';

export interface BlockchainConfig {
  rpcUrl: string;
  chainId: number;
  privateKey?: string;
  apiKey?: string;
}

export interface TransactionRequest {
  to: string;
  value: string;
  data?: string;
  gasLimit?: string;
}

export class BlockchainGateway {
  private provider: providers.JsonRpcProvider;
  private wallet: Wallet | null = null;
  private httpClient: AxiosInstance;
  private readonly chainId: number;

  constructor(config: BlockchainConfig, httpClient: AxiosInstance) {
    this.provider = new providers.JsonRpcProvider(config.rpcUrl);
    this.chainId = config.chainId;
    this.httpClient = httpClient;

    if (config.privateKey) {
      this.initializeWallet(config.privateKey);
    }
  }

  private initializeWallet(privateKey: string): void {
    try {
      this.wallet = new Wallet(privateKey, this.provider);
    } catch (error) {
      throw new Error('Failed to initialize wallet: Invalid private key');
    }
  }

  public async getBalance(address: string): Promise<string> {
    try {
      const balance = await this.provider.getBalance(address);
      return utils.formatEther(balance);
    } catch (error) {
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }

  public async sendTransaction(txRequest: TransactionRequest): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    try {
      const nonce = await this.wallet.getTransactionCount();
      const gasPrice = await this.provider.getGasPrice();

      const tx = await this.wallet.sendTransaction({
        to: txRequest.to,
        value: utils.parseEther(txRequest.value),
        data: txRequest.data || '0x',
        gasLimit: txRequest.gasLimit ? utils.hexlify(txRequest.gasLimit) : undefined,
        gasPrice,
        nonce,
        chainId: this.chainId
      });

      return tx.hash;
    } catch (error) {
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  public async getContract(address: string, abi: any[]): Promise<Contract> {
    try {
      return new Contract(address, abi, this.wallet || this.provider);
    } catch (error) {
      throw new Error(`Failed to initialize contract: ${error.message}`);
    }
  }

  public async estimateGas(txRequest: TransactionRequest): Promise<string> {
    try {
      const estimate = await this.provider.estimateGas({
        to: txRequest.to,
        value: utils.parseEther(txRequest.value),
        data: txRequest.data
      });
      return estimate.toString();
    } catch (error) {
      throw new Error(`Gas estimation failed: ${error.message}`);
    }
  }

  public generateNonce(): string {
    return createHash('sha256')
      .update(randomBytes(32))
      .digest('hex');
  }

  public async waitForTransaction(txHash: string, confirmations = 1): Promise<providers.TransactionReceipt> {
    try {
      return await this.provider.waitForTransaction(txHash, confirmations);
    } catch (error) {
      throw new Error(`Failed to wait for transaction: ${error.message}`);
    }
  }

  public async isAddressValid(address: string): Promise<boolean> {
    return utils.isAddress(address);
  }

  public async getNetworkStatus(): Promise<{
    blockNumber: number;
    gasPrice: string;
    chainId: number;
  }> {
    try {
      const [blockNumber, gasPrice] = await Promise.all([
        this.provider.getBlockNumber(),
        this.provider.getGasPrice()
      ]);

      return {
        blockNumber,
        gasPrice: utils.formatUnits(gasPrice, 'gwei'),
        chainId: this.chainId
      };
    } catch (error) {
      throw new Error(`Failed to get network status: ${error.message}`);
    }
  }
}
```