```typescript
import { ethers } from 'ethers';
import { Logger } from 'winston';
import { EventEmitter } from 'events';
import { keccak256 } from 'ethers/lib/utils';

interface EventLoggerConfig {
  provider: ethers.providers.Provider;
  logger?: Logger;
  maxRetries?: number;
  retryDelay?: number;
}

interface EventLog {
  eventName: string;
  blockNumber: number;
  transactionHash: string;
  timestamp: number;
  data: any;
}

export class BlockchainEventLogger extends EventEmitter {
  private readonly provider: ethers.providers.Provider;
  private readonly logger?: Logger;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private isRunning: boolean = false;
  private lastProcessedBlock: number = 0;

  constructor(config: EventLoggerConfig) {
    super();
    this.provider = config.provider;
    this.logger = config.logger;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  public async start(fromBlock?: number): Promise<void> {
    if (this.isRunning) {
      throw new Error('EventLogger is already running');
    }

    this.isRunning = true;
    this.lastProcessedBlock = fromBlock || await this.provider.getBlockNumber();

    try {
      await this.processPendingEvents();
      await this.subscribeToNewEvents();
    } catch (error) {
      this.isRunning = false;
      this.handleError('Failed to start event logger', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    this.removeAllListeners();
    this.logger?.info('EventLogger stopped');
  }

  private async processPendingEvents(): Promise<void> {
    const currentBlock = await this.provider.getBlockNumber();
    
    for (let blockNumber = this.lastProcessedBlock; blockNumber <= currentBlock; blockNumber++) {
      if (!this.isRunning) break;
      
      await this.processBlockWithRetry(blockNumber);
    }
  }

  private async processBlockWithRetry(blockNumber: number, attempt: number = 1): Promise<void> {
    try {
      const block = await this.provider.getBlock(blockNumber, true);
      if (!block) return;

      for (const tx of block.transactions) {
        if (typeof tx === 'string') continue;
        
        const receipt = await this.provider.getTransactionReceipt(tx.hash);
        if (!receipt) continue;

        for (const log of receipt.logs) {
          const eventLog: EventLog = {
            eventName: this.decodeEventName(log),
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            timestamp: block.timestamp,
            data: this.decodeEventData(log)
          };

          this.emit('event', eventLog);
          this.logger?.debug('Event processed', eventLog);
        }
      }

      this.lastProcessedBlock = blockNumber;
    } catch (error) {
      if (attempt < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        await this.processBlockWithRetry(blockNumber, attempt + 1);
      } else {
        this.handleError(`Failed to process block ${blockNumber}`, error);
        throw error;
      }
    }
  }

  private async subscribeToNewEvents(): Promise<void> {
    this.provider.on('block', async (blockNumber: number) => {
      if (!this.isRunning) return;
      
      try {
        await this.processBlockWithRetry(blockNumber);
      } catch (error) {
        this.handleError(`Failed to process new block ${blockNumber}`, error);
      }
    });
  }

  private decodeEventName(log: ethers.providers.Log): string {
    try {
      return keccak256(log.topics[0]).slice(0, 10);
    } catch {
      return 'unknown';
    }
  }

  private decodeEventData(log: ethers.providers.Log): any {
    try {
      return ethers.utils.defaultAbiCoder.decode(
        ['bytes'],
        ethers.utils.hexDataSlice(log.data, 0)
      );
    } catch {
      return log.data;
    }
  }

  private handleError(message: string, error: any): void {
    this.logger?.error(message, {
      error: error.message,
      stack: error.stack
    });
    this.emit('error', { message, error });
  }
}
```