```typescript
import { createHash } from 'crypto';
import { Block, Transaction, ValidationError } from './types';

export class BlockchainCore {
  private chain: Block[];
  private difficulty: number;
  private pendingTransactions: Transaction[];
  private miningReward: number;

  constructor() {
    this.chain = [this.createGenesisBlock()];
    this.difficulty = 4;
    this.pendingTransactions = [];
    this.miningReward = 100;
  }

  private createGenesisBlock(): Block {
    return {
      timestamp: Date.now(),
      transactions: [],
      previousHash: '0',
      hash: '0',
      nonce: 0
    };
  }

  private async calculateHash(block: Block): Promise<string> {
    const data = block.previousHash + 
                 block.timestamp + 
                 JSON.stringify(block.transactions) + 
                 block.nonce;
    
    return createHash('sha256').update(data).digest('hex');
  }

  public async getLatestBlock(): Promise<Block> {
    return this.chain[this.chain.length - 1];
  }

  public async addTransaction(transaction: Transaction): Promise<void> {
    if (!transaction.fromAddress || !transaction.toAddress) {
      throw new ValidationError('Transaction must include from and to address');
    }

    if (transaction.amount <= 0) {
      throw new ValidationError('Transaction amount must be greater than 0');
    }

    if (!this.validateTransactionSignature(transaction)) {
      throw new ValidationError('Invalid transaction signature');
    }

    this.pendingTransactions.push(transaction);
  }

  public async minePendingTransactions(miningRewardAddress: string): Promise<void> {
    const rewardTx: Transaction = {
      fromAddress: null,
      toAddress: miningRewardAddress,
      amount: this.miningReward,
      signature: ''
    };

    this.pendingTransactions.push(rewardTx);

    const block: Block = {
      timestamp: Date.now(),
      transactions: this.pendingTransactions,
      previousHash: (await this.getLatestBlock()).hash,
      hash: '',
      nonce: 0
    };

    await this.mineBlock(block);

    this.chain.push(block);
    this.pendingTransactions = [];
  }

  private async mineBlock(block: Block): Promise<void> {
    const target = Array(this.difficulty + 1).join('0');

    while (block.hash.substring(0, this.difficulty) !== target) {
      block.nonce++;
      block.hash = await this.calculateHash(block);
    }
  }

  public async validateChain(): Promise<boolean> {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      if (currentBlock.hash !== await this.calculateHash(currentBlock)) {
        return false;
      }

      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }
    }
    return true;
  }

  private validateTransactionSignature(transaction: Transaction): boolean {
    if (transaction.fromAddress === null) return true;
    
    // Implement actual signature validation logic here
    // Using public key cryptography (e.g. elliptic curve)
    return true; 
  }

  public async getBalance(address: string): Promise<number> {
    let balance = 0;

    for (const block of this.chain) {
      for (const trans of block.transactions) {
        if (trans.fromAddress === address) {
          balance -= trans.amount;
        }
        if (trans.toAddress === address) {
          balance += trans.amount;
        }
      }
    }

    return balance;
  }

  public async getBlocks(): Promise<Block[]> {
    return [...this.chain];
  }
}
```