```typescript
import { Transaction } from './types/Transaction';
import { Block } from './types/Block';
import { ValidationError } from './errors/ValidationError';
import { createHash } from 'crypto';
import { ec as EC } from 'elliptic';
import { Buffer } from 'buffer';

export class TransactionValidator {
  private readonly ec: EC;
  private readonly maxTxSize: number = 1000000; // 1MB
  private readonly minFee: bigint = BigInt(1000); // Min transaction fee

  constructor() {
    this.ec = new EC('secp256k1');
  }

  public async validateTransaction(tx: Transaction, block?: Block): Promise<boolean> {
    try {
      await this.validateBasics(tx);
      await this.validateSignature(tx);
      await this.validateAmount(tx);
      
      if (block) {
        await this.validateInBlock(tx, block);
      }
      
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Transaction validation failed: ${error.message}`);
    }
  }

  private async validateBasics(tx: Transaction): Promise<void> {
    if (!tx || !tx.id || !tx.from || !tx.to || !tx.signature) {
      throw new ValidationError('Missing required transaction fields');
    }

    if (Buffer.from(JSON.stringify(tx)).length > this.maxTxSize) {
      throw new ValidationError('Transaction size exceeds maximum allowed');
    }

    if (tx.timestamp > Date.now() + 300000) { // 5 min into future
      throw new ValidationError('Transaction timestamp too far in future');
    }

    if (tx.fee < this.minFee) {
      throw new ValidationError('Transaction fee below minimum required');
    }
  }

  private async validateSignature(tx: Transaction): Promise<void> {
    try {
      const txHash = this.calculateTxHash(tx);
      const key = this.ec.keyFromPublic(tx.from, 'hex');
      
      const validSig = key.verify(txHash, tx.signature);
      if (!validSig) {
        throw new ValidationError('Invalid transaction signature');
      }
    } catch (error) {
      throw new ValidationError(`Signature validation failed: ${error.message}`);
    }
  }

  private async validateAmount(tx: Transaction): Promise<void> {
    if (tx.amount <= BigInt(0)) {
      throw new ValidationError('Transaction amount must be positive');
    }

    if (tx.amount > tx.senderBalance) {
      throw new ValidationError('Insufficient sender balance');
    }

    const totalAmount = tx.amount + tx.fee;
    if (totalAmount > tx.senderBalance) {
      throw new ValidationError('Insufficient balance to cover amount + fee');
    }
  }

  private async validateInBlock(tx: Transaction, block: Block): Promise<void> {
    if (tx.timestamp > block.timestamp) {
      throw new ValidationError('Transaction timestamp after block timestamp');
    }

    if (block.transactions.filter(t => t.id === tx.id).length > 1) {
      throw new ValidationError('Duplicate transaction in block');
    }
  }

  private calculateTxHash(tx: Transaction): string {
    const txData = {
      from: tx.from,
      to: tx.to,
      amount: tx.amount.toString(),
      fee: tx.fee.toString(),
      timestamp: tx.timestamp,
      nonce: tx.nonce
    };

    return createHash('sha256')
      .update(JSON.stringify(txData))
      .digest('hex');
  }

  public async validateBatch(transactions: Transaction[]): Promise<boolean> {
    try {
      const results = await Promise.all(
        transactions.map(tx => this.validateTransaction(tx))
      );
      return results.every(result => result === true);
    } catch (error) {
      throw new ValidationError(`Batch validation failed: ${error.message}`);
    }
  }
}
```