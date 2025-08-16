```typescript
import { Hash, Block, Transaction, PublicKey, Signature } from './types';
import { SHA256 } from 'crypto-js';
import { validateBlock, verifySignature } from './crypto-utils';
import { ConsensusError } from './errors';

export class ConsensusEngine {
  private readonly validators: Set<PublicKey>;
  private readonly requiredValidations: number;
  private pendingBlocks: Map<Hash, Block>;
  private validations: Map<Hash, Set<PublicKey>>;
  
  constructor(validators: PublicKey[], requiredValidations: number) {
    if (requiredValidations > validators.length) {
      throw new ConsensusError('Required validations cannot exceed validator count');
    }
    
    this.validators = new Set(validators);
    this.requiredValidations = requiredValidations;
    this.pendingBlocks = new Map();
    this.validations = new Map();
  }

  public async proposeBlock(block: Block): Promise<boolean> {
    try {
      const blockHash = this.calculateBlockHash(block);
      
      if (this.pendingBlocks.has(blockHash)) {
        throw new ConsensusError('Block already proposed');
      }

      if (!await validateBlock(block)) {
        throw new ConsensusError('Invalid block proposed');
      }

      this.pendingBlocks.set(blockHash, block);
      this.validations.set(blockHash, new Set());

      return true;
    } catch (error) {
      console.error('Block proposal failed:', error);
      return false;
    }
  }

  public async validateBlock(
    blockHash: Hash, 
    validatorKey: PublicKey,
    signature: Signature
  ): Promise<boolean> {
    try {
      if (!this.validators.has(validatorKey)) {
        throw new ConsensusError('Unknown validator');
      }

      const block = this.pendingBlocks.get(blockHash);
      if (!block) {
        throw new ConsensusError('Unknown block');
      }

      if (!await verifySignature(blockHash, signature, validatorKey)) {
        throw new ConsensusError('Invalid signature');
      }

      const blockValidations = this.validations.get(blockHash);
      if (!blockValidations) {
        throw new ConsensusError('Block validation set not found');
      }

      blockValidations.add(validatorKey);

      return blockValidations.size >= this.requiredValidations;
    } catch (error) {
      console.error('Block validation failed:', error);
      return false;
    }
  }

  public async getFinalizedBlocks(): Promise<Block[]> {
    const finalizedBlocks: Block[] = [];

    for (const [hash, validations] of this.validations.entries()) {
      if (validations.size >= this.requiredValidations) {
        const block = this.pendingBlocks.get(hash);
        if (block) {
          finalizedBlocks.push(block);
          this.pendingBlocks.delete(hash);
          this.validations.delete(hash);
        }
      }
    }

    return finalizedBlocks;
  }

  private calculateBlockHash(block: Block): Hash {
    const blockString = JSON.stringify({
      prevHash: block.prevHash,
      timestamp: block.timestamp,
      transactions: block.transactions.map(t => t.id),
      height: block.height
    });
    
    return SHA256(blockString).toString();
  }

  public getValidatorCount(): number {
    return this.validators.size;
  }

  public getPendingBlockCount(): number {
    return this.pendingBlocks.size;
  }

  public clearPendingBlocks(): void {
    this.pendingBlocks.clear();
    this.validations.clear();
  }
}
```