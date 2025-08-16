```typescript
import { Block, Transaction, ValidationResult } from './types';
import { SHA256 } from 'crypto-js';
import { EventEmitter } from 'events';
import { ECPair, crypto } from 'bitcoinjs-lib';
import { Logger } from './logger';

export class ConsensusEngine extends EventEmitter {
  private readonly validators: Set<string>;
  private readonly pendingBlocks: Map<string, Block>;
  private currentBlock: Block | null;
  private chainHead: string;
  private readonly logger: Logger;

  constructor(validators: string[], chainHead: string) {
    super();
    this.validators = new Set(validators);
    this.pendingBlocks = new Map();
    this.currentBlock = null;
    this.chainHead = chainHead;
    this.logger = new Logger('ConsensusEngine');
  }

  public async proposeBlock(block: Block): Promise<ValidationResult> {
    try {
      if (!this.validators.has(block.proposer)) {
        throw new Error('Invalid block proposer');
      }

      const isValid = await this.validateBlock(block);
      if (!isValid) {
        throw new Error('Invalid block');
      }

      this.pendingBlocks.set(block.hash, block);
      this.emit('blockProposed', block);

      return {
        valid: true,
        hash: block.hash
      };
    } catch (error) {
      this.logger.error('Block proposal failed', error);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  public async validateBlock(block: Block): Promise<boolean> {
    try {
      // Verify block hash
      const calculatedHash = this.calculateBlockHash(block);
      if (calculatedHash !== block.hash) {
        return false;
      }

      // Verify previous block reference
      if (block.previousHash !== this.chainHead) {
        return false;
      }

      // Verify transactions
      for (const tx of block.transactions) {
        if (!await this.validateTransaction(tx)) {
          return false;
        }
      }

      // Verify block signature
      return this.verifyBlockSignature(block);

    } catch (error) {
      this.logger.error('Block validation failed', error);
      return false;
    }
  }

  private async validateTransaction(tx: Transaction): Promise<boolean> {
    try {
      // Verify transaction signature
      const signatureValid = crypto.verify(
        Buffer.from(tx.hash),
        Buffer.from(tx.signature, 'hex'),
        Buffer.from(tx.publicKey, 'hex')
      );

      if (!signatureValid) {
        return false;
      }

      // Additional transaction validation logic here
      return true;

    } catch (error) {
      this.logger.error('Transaction validation failed', error);
      return false;
    }
  }

  private calculateBlockHash(block: Block): string {
    const blockData = {
      previousHash: block.previousHash,
      timestamp: block.timestamp,
      transactions: block.transactions,
      nonce: block.nonce
    };
    return SHA256(JSON.stringify(blockData)).toString();
  }

  private verifyBlockSignature(block: Block): boolean {
    try {
      const keyPair = ECPair.fromPublicKey(Buffer.from(block.proposer, 'hex'));
      return keyPair.verify(
        Buffer.from(block.hash),
        Buffer.from(block.signature, 'hex')
      );
    } catch (error) {
      this.logger.error('Block signature verification failed', error);
      return false;
    }
  }

  public async finalizeBlock(hash: string): Promise<void> {
    const block = this.pendingBlocks.get(hash);
    if (!block) {
      throw new Error('Block not found');
    }

    this.currentBlock = block;
    this.chainHead = block.hash;
    this.pendingBlocks.delete(hash);
    this.emit('blockFinalized', block);
  }

  public getCurrentBlock(): Block | null {
    return this.currentBlock;
  }

  public getChainHead(): string {
    return this.chainHead;
  }
}
```