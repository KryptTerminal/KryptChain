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
      throw new Error('Invalid hashing algorithm specified');
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
      let hash = Buffer.isBuffer(data) ? data : Buffer.from(data);

      for (let i = 0; i < this.iterations; i++) {
        hash = createHash(this.algorithm).update(hash).digest();
      }

      return hash.toString(this.encoding);
    } catch (error) {
      throw new Error(`Hashing failed: ${(error as Error).message}`);
    }
  }

  public async hashWithSalt(
    data: string | Buffer,
    salt?: string | Buffer
  ): Promise<{ hash: string; salt: string }> {
    try {
      const saltBuffer = salt
        ? Buffer.isBuffer(salt)
          ? salt
          : Buffer.from(salt)
        : randomBytes(32);

      const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const combinedBuffer = Buffer.concat([saltBuffer, dataBuffer]);
      
      const hash = await this.hash(combinedBuffer);

      return {
        hash,
        salt: saltBuffer.toString(this.encoding)
      };
    } catch (error) {
      throw new Error(`Salted hashing failed: ${(error as Error).message}`);
    }
  }

  public async verifyHash(
    data: string | Buffer,
    hash: string
  ): Promise<boolean> {
    try {
      const computedHash = await this.hash(data);
      return computedHash === hash;
    } catch (error) {
      throw new Error(`Hash verification failed: ${(error as Error).message}`);
    }
  }

  public async verifySaltedHash(
    data: string | Buffer,
    hash: string,
    salt: string
  ): Promise<boolean> {
    try {
      const { hash: computedHash } = await this.hashWithSalt(data, salt);
      return computedHash === hash;
    } catch (error) {
      throw new Error(`Salted hash verification failed: ${(error as Error).message}`);
    }
  }

  public async doubleHash(data: string | Buffer): Promise<string> {
    try {
      const firstHash = await this.hash(data);
      return this.hash(firstHash);
    } catch (error) {
      throw new Error(`Double hashing failed: ${(error as Error).message}`);
    }
  }

  public async merkleHash(items: (string | Buffer)[]): Promise<string> {
    try {
      if (!items.length) {
        throw new Error('Empty array provided for Merkle hash');
      }

      const hashes = await Promise.all(items.map(item => this.hash(item)));
      
      while (hashes.length > 1) {
        const temp: string[] = [];
        for (let i = 0; i < hashes.length; i += 2) {
          if (i + 1 === hashes.length) {
            temp.push(await this.hash(hashes[i] + hashes[i]));
          } else {
            temp.push(await this.hash(hashes[i] + hashes[i + 1]));
          }
        }
        hashes.splice(0, hashes.length, ...temp);
      }

      return hashes[0];
    } catch (error) {
      throw new Error(`Merkle hash calculation failed: ${(error as Error).message}`);
    }
  }
}
```