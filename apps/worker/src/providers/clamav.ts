import { Socket } from 'node:net';

import type { MalwareScanner } from './contracts.js';

export class ClamAvInstreamScanner implements MalwareScanner {
  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly timeoutMs: number,
  ) {}

  async scan(content: AsyncIterable<Uint8Array>): Promise<{ clean: boolean; signature?: string }> {
    const socket = new Socket();
    const response = await new Promise<string>(async (resolve, reject) => {
      const chunks: Buffer[] = [];
      socket.setTimeout(this.timeoutMs);
      socket.once('error', reject);
      socket.once('timeout', () => reject(new Error('ClamAV scan timed out.')));
      socket.on('data', (chunk: Buffer) => chunks.push(chunk));
      socket.once('end', () => resolve(Buffer.concat(chunks).toString('utf8').trim()));
      socket.connect(this.port, this.host, async () => {
        try {
          socket.write('zINSTREAM\0');
          for await (const chunk of content) {
            const data = Buffer.from(chunk);
            const size = Buffer.allocUnsafe(4);
            size.writeUInt32BE(data.length);
            socket.write(size);
            socket.write(data);
          }
          socket.end(Buffer.alloc(4));
        } catch (error) {
          socket.destroy(error instanceof Error ? error : new Error('ClamAV stream failed.'));
        }
      });
    });
    if (response.endsWith(' OK')) return { clean: true };
    if (response.endsWith(' FOUND'))
      return { clean: false, signature: response.slice(0, -' FOUND'.length) };
    throw new Error(`ClamAV returned an invalid result: ${response.slice(0, 200)}`);
  }
}
