```typescript
import { Transaction } from './Transaction';
import { Blockchain } from './Blockchain';
import { EventEmitter } from 'events';
import { SHA256 } from 'crypto-js';

interface PoolTransaction extends Transaction {
  timestamp: number;
  seen: Set<string>;
}

export class TransactionPool extends EventEmitter {
  private transactions: Map<string, PoolTransaction>;
  private maxSize: number;
  private blockchain: Blockchain;
  private readonly MAX_AGE_MS = 3600000; // 1 hour
  private readonly MAX_SIZE_BYTES = 5000000; // 5MB

  constructor(blockchain: Blockchain, maxSize = 5000) {
    super();
    this.transactions = new Map();
    this.maxSize = maxSize;
    this.blockchain = blockchain;
  }

  public async addTransaction(transaction: Transaction): Promise<boolean> {
    try {
      const txHash = this.getTransactionHash(transaction);

      if (this.transactions.has(txHash)) {
        return false;
      }

      await this.validateTransaction(transaction);

      if (this.getPoolSize() >= this.maxSize) {
        this.removeOldestTransactions();
      }

      const poolTx: PoolTransaction = {
        ...transaction,
        timestamp: Date.now(),
        seen: new Set()
      };

      this.transactions.set(txHash, poolTx);
      this.emit('transaction', transaction);

      return true;
    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }

  public getTransaction(txHash: string): Transaction | undefined {
    return this.transactions.get(txHash);
  }

  public getAllTransactions(): Transaction[] {
    return Array.from(this.transactions.values());
  }

  public removeTransaction(txHash: string): boolean {
    return this.transactions.delete(txHash);
  }

  public clear(): void {
    this.transactions.clear();
  }

  public getPoolSize(): number {
    return this.transactions.size;
  }

  private async validateTransaction(tx: Transaction): Promise<void> {
    if (!tx.signature || !tx.fromAddress || !tx.toAddress || tx.amount <= 0) {
      throw new Error('Invalid transaction format');
    }

    const isValid = await this.blockchain.verifyTransaction(tx);
    if (!isValid) {
      throw new Error('Transaction signature verification failed');
    }

    const senderBalance = await this.blockchain.getAddressBalance(tx.fromAddress);
    if (senderBalance < tx.amount) {
      throw new Error('Insufficient balance');
    }

    const txSize = this.getTransactionSize(tx);
    if (txSize > this.MAX_SIZE_BYTES) {
      throw new Error('Transaction size exceeds limit');
    }
  }

  private getTransactionHash(tx: Transaction): string {
    return SHA256(JSON.stringify({
      fromAddress: tx.fromAddress,
      toAddress: tx.toAddress,
      amount: tx.amount,
      timestamp: tx.timestamp
    })).toString();
  }

  private getTransactionSize(tx: Transaction): number {
    return Buffer.from(JSON.stringify(tx)).length;
  }

  private removeOldestTransactions(): void {
    const now = Date.now();
    for (const [hash, tx] of this.transactions.entries()) {
      if (now - tx.timestamp > this.MAX_AGE_MS) {
        this.transactions.delete(hash);
      }
    }
  }

  public async cleanPool(): Promise<void> {
    const confirmedTxs = await this.blockchain.getConfirmedTransactions();
    for (const tx of confirmedTxs) {
      const txHash = this.getTransactionHash(tx);
      this.transactions.delete(txHash);
    }
    this.removeOldestTransactions();
  }
}
```