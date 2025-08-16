```typescript
import { createHash } from 'crypto';
import WebSocket from 'ws';
import { Transaction, Block, BlockchainConfig } from './types';

export class NetworkNode {
  private peers: Map<string, WebSocket>;
  private nodeId: string;
  private blockchain: Block[];
  private pendingTransactions: Transaction[];
  private config: BlockchainConfig;

  constructor(config: BlockchainConfig) {
    this.peers = new Map();
    this.nodeId = createHash('sha256').update(Date.now().toString()).digest('hex');
    this.blockchain = [];
    this.pendingTransactions = [];
    this.config = config;
  }

  public async initialize(): Promise<void> {
    try {
      await this.setupWebSocket();
      await this.connectToPeers();
      this.startHeartbeat();
    } catch (error) {
      throw new Error(`Failed to initialize node: ${error.message}`);
    }
  }

  private async setupWebSocket(): Promise<void> {
    const ws = new WebSocket(this.config.wsEndpoint);

    ws.on('open', () => {
      this.broadcast({
        type: 'NEW_NODE',
        nodeId: this.nodeId,
        timestamp: Date.now()
      });
    });

    ws.on('message', async (data: string) => {
      try {
        const message = JSON.parse(data);
        await this.handleMessage(message);
      } catch (error) {
        console.error(`Invalid message received: ${error.message}`);
      }
    });
  }

  private async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'NEW_BLOCK':
        await this.validateAndAddBlock(message.block);
        break;
      case 'NEW_TRANSACTION':
        await this.validateAndAddTransaction(message.transaction);
        break;
      case 'CHAIN_REQUEST':
        this.sendChain(message.nodeId);
        break;
      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  private async validateAndAddBlock(block: Block): Promise<void> {
    if (!this.isValidBlock(block)) {
      throw new Error('Invalid block received');
    }

    this.blockchain.push(block);
    this.pendingTransactions = this.pendingTransactions.filter(tx => 
      !block.transactions.find(blockTx => blockTx.id === tx.id)
    );

    this.broadcast({
      type: 'BLOCK_ADDED',
      blockHash: block.hash,
      nodeId: this.nodeId
    });
  }

  private async validateAndAddTransaction(transaction: Transaction): Promise<void> {
    if (!this.isValidTransaction(transaction)) {
      throw new Error('Invalid transaction received');
    }

    this.pendingTransactions.push(transaction);

    if (this.pendingTransactions.length >= this.config.maxTransactionsPerBlock) {
      await this.mineBlock();
    }
  }

  private async mineBlock(): Promise<void> {
    const newBlock: Block = {
      index: this.blockchain.length,
      timestamp: Date.now(),
      transactions: this.pendingTransactions.slice(0, this.config.maxTransactionsPerBlock),
      previousHash: this.blockchain[this.blockchain.length - 1]?.hash || '0',
      hash: '',
      nonce: 0
    };

    newBlock.hash = await this.findBlockHash(newBlock);
    await this.validateAndAddBlock(newBlock);
  }

  private async findBlockHash(block: Block): Promise<string> {
    let nonce = 0;
    let hash = '';

    while (!hash.startsWith('0'.repeat(this.config.difficulty))) {
      nonce++;
      const data = JSON.stringify({...block, nonce});
      hash = createHash('sha256').update(data).digest('hex');
    }

    return hash;
  }

  private isValidBlock(block: Block): boolean {
    return (
      block.index === this.blockchain.length &&
      block.previousHash === (this.blockchain[this.blockchain.length - 1]?.hash || '0') &&
      block.hash.startsWith('0'.repeat(this.config.difficulty)) &&
      block.transactions.every(tx => this.isValidTransaction(tx))
    );
  }

  private isValidTransaction(transaction: Transaction): boolean {
    return (
      !!transaction.id &&
      !!transaction.fromAddress &&
      !!transaction.toAddress &&
      transaction.amount > 0 &&
      transaction.signature
    );
  }

  private broadcast(message: any): void {
    const messageStr = JSON.stringify(message);
    this.peers.forEach(peer => {
      if (peer.readyState === WebSocket.OPEN) {
        peer.send(messageStr);
      }
    });
  }

  private startHeartbeat(): void {
    setInterval(() => {
      this.broadcast({
        type: 'HEARTBEAT',
        nodeId: this.nodeId,
        timestamp: Date.now()
      });
    }, this.config.heartbeatInterval);
  }

  public getBlockchain(): Block[] {
    return [...this.blockchain];
  }

  public getPendingTransactions(): Transaction[] {
    return [...this.pendingTransactions];
  }
}
```