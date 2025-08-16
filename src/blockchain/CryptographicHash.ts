```typescript
import { createHash, randomBytes } from 'crypto';
import { Buffer } from 'buffer';

export class CryptographicHash {
  private readonly algorithm: string;
  private readonly encoding: BufferEncoding;
  private readonly iterations: number;

  constructor(
    algorithm: string = 'sha256',
    encoding: BufferEncoding = 'hex',
    iterations: number = 1
  ) {
    if (!['sha256', 'sha512', 'sha3-256', 'sha3-512'].includes(algorithm)) {
      throw new Error('Invalid hash algorithm specified');
    }
    if (iterations < 1) {
      throw new Error('Iterations must be greater than 0');
    }

    this.algorithm = algorithm;
    this.encoding = encoding;
    this.iterations = iterations;
  }

  public async hash(data: string | Buffer): Promise<string> {
    try {
      let buffer: Buffer;
      
      if (typeof data === 'string') {
        buffer = Buffer.from(data);
      } else {
        buffer = data;
      }

      let hash = buffer;
      for (let i = 0; i < this.iterations; i++) {
        hash = createHash(this.algorithm).update(hash).digest();
      }

      return hash.toString(this.encoding);
    } catch (error) {
      throw new Error(`Failed to generate hash: ${error.message}`);
    }
  }

  public async generateSalt(length: number = 32): Promise<string> {
    try {
      return new Promise((resolve, reject) => {
        randomBytes(length, (err, buffer) => {
          if (err) reject(err);
          resolve(buffer.toString(this.encoding));
        });
      });
    } catch (error) {
      throw new Error(`Failed to generate salt: ${error.message}`);
    }
  }

  public async hashWithSalt(data: string, salt?: string): Promise<{hash: string, salt: string}> {
    try {
      const useSalt = salt || await this.generateSalt();
      const combinedData = Buffer.concat([
        Buffer.from(data),
        Buffer.from(useSalt)
      ]);
      
      const hashedData = await this.hash(combinedData);
      
      return {
        hash: hashedData,
        salt: useSalt
      };
    } catch (error) {
      throw new Error(`Failed to generate salted hash: ${error.message}`);
    }
  }

  public async verify(data: string, hash: string, salt?: string): Promise<boolean> {
    try {
      if (salt) {
        const hashedData = await this.hashWithSalt(data, salt);
        return hashedData.hash === hash;
      }
      
      const hashedData = await this.hash(data);
      return hashedData === hash;
    } catch (error) {
      throw new Error(`Failed to verify hash: ${error.message}`);
    }
  }

  public async doubleHash(data: string | Buffer): Promise<string> {
    try {
      const firstHash = await this.hash(data);
      return this.hash(firstHash);
    } catch (error) {
      throw new Error(`Failed to generate double hash: ${error.message}`);
    }
  }

  public async merkleHash(dataArray: string[]): Promise<string> {
    try {
      if (!dataArray.length) {
        throw new Error('Empty array provided for Merkle hash');
      }

      const leaves = await Promise.all(dataArray.map(data => this.hash(data)));
      
      let level = leaves;
      while (level.length > 1) {
        const nextLevel: string[] = [];
        for (let i = 0; i < level.length; i += 2) {
          if (i + 1 === level.length) {
            nextLevel.push(level[i]);
          } else {
            const combined = level[i] + level[i + 1];
            const hash = await this.hash(combined);
            nextLevel.push(hash);
          }
        }
        level = nextLevel;
      }

      return level[0];
    } catch (error) {
      throw new Error(`Failed to generate Merkle hash: ${error.message}`);
    }
  }
}
```