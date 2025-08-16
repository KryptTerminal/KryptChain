```typescript
import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';

export interface Block {
  index: number;
  timestamp: number;
  data: any;
  previousHash: string;
  hash: string;
  nonce: number;
}

export interface StorageConfig {
  difficulty: number;
  path?: string;
  encryptionKey?: string;
}

export class BlockchainStorage extends EventEmitter {
  private chain: Block[] = [];
  private readonly difficulty: number;
  private readonly storagePath?: string;
  private readonly encryptionKey?: string;

  constructor(config: StorageConfig) {
    super();
    this.difficulty = config.difficulty;
    this.storagePath = config.path;
    this.encryptionKey = config.encryptionKey;
  }

  async initialize(): Promise<void> {
    if (!this.chain.length) {
      const genesisBlock = await this.createGenesisBlock();
      this.chain.push(genesisBlock);
      await this.persistChain();
    }
  }

  private async createGenesisBlock(): Promise<Block> {
    return this.createBlock(0, "Genesis Block", "0");
  }

  private async createBlock(index: number, data: any, previousHash: string): Promise<Block> {
    const block: Block = {
      index,
      timestamp: Date.now(),
      data,
      previousHash,
      hash: '',
      nonce: 0
    };

    return this.mineBlock(block);
  }

  private async mineBlock(block: Block): Promise<Block> {
    const target = Array(this.difficulty + 1).join('0');

    while (block.hash.substring(0, this.difficulty) !== target) {
      block.nonce++;
      block.hash = this.calculateHash(block);
    }

    return block;
  }

  private calculateHash(block: Block): string {
    return createHash('sha256')
      .update(
        block.index +
        block.previousHash +
        block.timestamp +
        JSON.stringify(block.data) +
        block.nonce
      )
      .digest('hex');
  }

  async addBlock(data: any): Promise<Block> {
    try {
      const previousBlock = this.getLatestBlock();
      const newBlock = await this.createBlock(
        previousBlock.index + 1,
        data,
        previousBlock.hash
      );

      if (this.isValidNewBlock(newBlock, previousBlock)) {
        this.chain.push(newBlock);
        await this.persistChain();
        this.emit('blockAdded', newBlock);
        return newBlock;
      }
      throw new Error('Invalid block');
    } catch (error) {
      throw new Error(`Failed to add block: ${error.message}`);
    }
  }

  private isValidNewBlock(newBlock: Block, previousBlock: Block): boolean {
    if (previousBlock.index + 1 !== newBlock.index) {
      return false;
    }
    if (previousBlock.hash !== newBlock.previousHash) {
      return false;
    }
    if (this.calculateHash(newBlock) !== newBlock.hash) {
      return false;
    }
    return true;
  }

  async isChainValid(): Promise<boolean> {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      if (!this.isValidNewBlock(currentBlock, previousBlock)) {
        return false;
      }
    }
    return true;
  }

  private async persistChain(): Promise<void> {
    if (this.storagePath) {
      const data = this.encryptionKey 
        ? this.encrypt(JSON.stringify(this.chain))
        : JSON.stringify(this.chain);
        
      await fs.writeFile(this.storagePath, data, 'utf8');
    }
  }

  private encrypt(data: string): string {
    if (!this.encryptionKey) return data;
    // Implement encryption logic here
    return data;
  }

  private decrypt(data: string): string {
    if (!this.encryptionKey) return data;
    // Implement decryption logic here
    return data;
  }

  getLatestBlock(): Block {
    return this.chain[this.chain.length - 1];
  }

  getChain(): Block[] {
    return [...this.chain];
  }

  async getBlockByIndex(index: number): Promise<Block | null> {
    return this.chain.find(block => block.index === index) || null;
  }

  async getBlockByHash(hash: string): Promise<Block | null> {
    return this.chain.find(block => block.hash === hash) || null;
  }
}
```