```typescript
import { Hash, Block, Transaction, Address, Account } from './types';
import { createHash } from 'crypto';
import { LRUCache } from './cache';
import { DatabaseClient } from './database';
import { ValidationError, StateError } from './errors';

export class StateManager {
  private readonly stateCache: LRUCache<string, Account>;
  private readonly blockCache: LRUCache<Hash, Block>;
  private readonly db: DatabaseClient;
  private currentBlock: Block;

  constructor(dbClient: DatabaseClient, cacheSize = 1000) {
    this.stateCache = new LRUCache<string, Account>(cacheSize);
    this.blockCache = new LRUCache<Hash, Block>(100);
    this.db = dbClient;
  }

  public async initialize(): Promise<void> {
    try {
      this.currentBlock = await this.db.getLatestBlock();
      if (!this.currentBlock) {
        throw new StateError('Failed to initialize state manager');
      }
    } catch (error) {
      throw new StateError(`State initialization failed: ${error.message}`);
    }
  }

  public async getAccount(address: Address): Promise<Account> {
    try {
      const cachedAccount = this.stateCache.get(address.toString());
      if (cachedAccount) {
        return cachedAccount;
      }

      const account = await this.db.getAccount(address);
      if (!account) {
        return this.createEmptyAccount(address);
      }

      this.stateCache.set(address.toString(), account);
      return account;
    } catch (error) {
      throw new StateError(`Failed to get account: ${error.message}`);
    }
  }

  public async updateAccount(address: Address, account: Account): Promise<void> {
    try {
      await this.validateAccount(account);
      await this.db.updateAccount(address, account);
      this.stateCache.set(address.toString(), account);
    } catch (error) {
      throw new StateError(`Failed to update account: ${error.message}`);
    }
  }

  public async applyTransaction(tx: Transaction): Promise<void> {
    try {
      const sender = await this.getAccount(tx.from);
      const recipient = await this.getAccount(tx.to);

      if (sender.balance < tx.value + tx.fee) {
        throw new ValidationError('Insufficient balance');
      }

      sender.balance -= (tx.value + tx.fee);
      sender.nonce += 1;
      recipient.balance += tx.value;

      await this.updateAccount(tx.from, sender);
      await this.updateAccount(tx.to, recipient);
    } catch (error) {
      throw new StateError(`Transaction application failed: ${error.message}`);
    }
  }

  public async commitBlock(block: Block): Promise<void> {
    try {
      for (const tx of block.transactions) {
        await this.applyTransaction(tx);
      }

      this.currentBlock = block;
      this.blockCache.set(block.hash, block);
      await this.db.saveBlock(block);
    } catch (error) {
      throw new StateError(`Block commit failed: ${error.message}`);
    }
  }

  public async revertBlock(blockHash: Hash): Promise<void> {
    try {
      const block = await this.getBlock(blockHash);
      for (const tx of block.transactions.reverse()) {
        await this.revertTransaction(tx);
      }
      this.currentBlock = await this.getBlock(block.parentHash);
    } catch (error) {
      throw new StateError(`Block revert failed: ${error.message}`);
    }
  }

  private async validateAccount(account: Account): Promise<void> {
    if (account.balance < 0 || account.nonce < 0) {
      throw new ValidationError('Invalid account state');
    }
  }

  private createEmptyAccount(address: Address): Account {
    return {
      address,
      balance: 0n,
      nonce: 0,
      codeHash: createHash('sha256').update('').digest('hex'),
      storageRoot: createHash('sha256').update('').digest('hex')
    };
  }

  private async getBlock(hash: Hash): Promise<Block> {
    const cached = this.blockCache.get(hash);
    if (cached) {
      return cached;
    }
    return await this.db.getBlock(hash);
  }

  private async revertTransaction(tx: Transaction): Promise<void> {
    const sender = await this.getAccount(tx.from);
    const recipient = await this.getAccount(tx.to);

    sender.balance += (tx.value + tx.fee);
    sender.nonce -= 1;
    recipient.balance -= tx.value;

    await this.updateAccount(tx.from, sender);
    await this.updateAccount(tx.to, recipient);
  }
}
```