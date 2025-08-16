```typescript
import { ethers } from 'ethers';
import { Buffer } from 'buffer';
import {
  IWalletManager,
  WalletConfig,
  Network,
  TransactionParams,
  WalletBalances
} from './types';

export class WalletManager implements IWalletManager {
  private readonly provider: ethers.providers.Provider;
  private wallet: ethers.Wallet | null = null;
  private readonly networkConfig: Network;
  private readonly encryptionKey: Buffer;

  constructor(config: WalletConfig) {
    this.provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
    this.networkConfig = config.network;
    this.encryptionKey = Buffer.from(config.encryptionKey, 'hex');
  }

  public async createWallet(): Promise<string> {
    try {
      const wallet = ethers.Wallet.createRandom();
      this.wallet = wallet.connect(this.provider);
      const encryptedKey = await this.encryptPrivateKey(wallet.privateKey);
      return wallet.address;
    } catch (error) {
      throw new Error(`Failed to create wallet: ${error.message}`);
    }
  }

  public async importWallet(privateKey: string): Promise<string> {
    try {
      const wallet = new ethers.Wallet(privateKey, this.provider);
      this.wallet = wallet;
      const encryptedKey = await this.encryptPrivateKey(privateKey);
      return wallet.address;
    } catch (error) {
      throw new Error(`Failed to import wallet: ${error.message}`);
    }
  }

  public async getBalance(): Promise<WalletBalances> {
    if (!this.wallet) {
      throw new Error('No wallet initialized');
    }

    try {
      const ethBalance = await this.wallet.getBalance();
      const tokenBalances = await this.getTokenBalances();

      return {
        eth: ethers.utils.formatEther(ethBalance),
        tokens: tokenBalances
      };
    } catch (error) {
      throw new Error(`Failed to get balances: ${error.message}`);
    }
  }

  public async sendTransaction(params: TransactionParams): Promise<string> {
    if (!this.wallet) {
      throw new Error('No wallet initialized');
    }

    try {
      const tx = await this.wallet.sendTransaction({
        to: params.to,
        value: ethers.utils.parseEther(params.value.toString()),
        gasLimit: params.gasLimit,
        gasPrice: await this.provider.getGasPrice()
      });

      const receipt = await tx.wait();
      return receipt.transactionHash;
    } catch (error) {
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  public async signMessage(message: string): Promise<string> {
    if (!this.wallet) {
      throw new Error('No wallet initialized');
    }

    try {
      return await this.wallet.signMessage(message);
    } catch (error) {
      throw new Error(`Failed to sign message: ${error.message}`);
    }
  }

  private async encryptPrivateKey(privateKey: string): Promise<Buffer> {
    try {
      const cipher = await import('crypto').then(crypto => 
        crypto.createCipheriv('aes-256-gcm', this.encryptionKey, Buffer.alloc(16, 0))
      );
      
      const encrypted = Buffer.concat([
        cipher.update(Buffer.from(privateKey)),
        cipher.final()
      ]);

      return Buffer.concat([encrypted, cipher.getAuthTag()]);
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  private async getTokenBalances(): Promise<Record<string, string>> {
    // Implementation would check ERC20 token balances
    // This is a simplified version
    return {};
  }

  public getAddress(): string {
    if (!this.wallet) {
      throw new Error('No wallet initialized');
    }
    return this.wallet.address;
  }

  public async disconnect(): Promise<void> {
    this.wallet = null;
  }

  public isConnected(): boolean {
    return this.wallet !== null;
  }
}
```