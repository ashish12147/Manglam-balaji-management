import { once } from 'node:events';
import { Socket } from 'node:net';

import type { MalwareScanner } from './contracts.js';

const MAXIMUM_RESPONSE_BYTES = 4_096;

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error('ClamAV stream failed.');
}

async function write(socket: Socket, data: Uint8Array): Promise<void> {
  if (!socket.write(data)) await once(socket, 'drain');
}

export class ClamAvInstreamScanner implements MalwareScanner {
  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly timeoutMs: number,
  ) {}

  async scan(content: AsyncIterable<Uint8Array>): Promise<{ clean: boolean; signature?: string }> {
    const socket = new Socket();
    const response = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let responseBytes = 0;
      let settled = false;

      const fail = (error: unknown): void => {
        if (settled) return;
        settled = true;
        socket.destroy();
        reject(asError(error));
      };
      const succeed = (value: Buffer): void => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(value.toString('utf8').trim());
      };

      socket.setTimeout(this.timeoutMs);
      socket.once('error', fail);
      socket.once('timeout', () => fail(new Error('ClamAV scan timed out.')));
      socket.once('close', (hadError) => {
        if (!settled && !hadError) fail(new Error('ClamAV closed without a scan result.'));
      });
      socket.on('data', (chunk: Buffer) => {
        if (settled) return;
        responseBytes += chunk.length;
        if (responseBytes > MAXIMUM_RESPONSE_BYTES) {
          fail(new Error('ClamAV scan result exceeded the allowed size.'));
          return;
        }
        chunks.push(chunk);
        const result = Buffer.concat(chunks, responseBytes);
        const terminator = result.indexOf(0);
        if (terminator < 0) return;
        if (terminator !== result.length - 1) {
          fail(new Error('ClamAV returned data after the result terminator.'));
          return;
        }
        succeed(result.subarray(0, terminator));
      });
      socket.once('end', () => {
        if (!settled) succeed(Buffer.concat(chunks, responseBytes));
      });
      socket.connect(this.port, this.host, () => {
        void (async () => {
          try {
            await write(socket, Buffer.from('zINSTREAM\0', 'utf8'));
            let streamedBytes = 0;
            for await (const chunk of content) {
              if (chunk.byteLength === 0) continue;
              const data = Buffer.from(chunk);
              const size = Buffer.allocUnsafe(4);
              size.writeUInt32BE(data.length);
              await write(socket, size);
              await write(socket, data);
              streamedBytes += data.length;
            }
            if (streamedBytes === 0) throw new Error('ClamAV scan content is empty.');
            socket.end(Buffer.alloc(4));
          } catch (error) {
            fail(error);
          }
        })();
      });
    });
    if (response.endsWith(' OK')) return { clean: true };
    if (response.endsWith(' FOUND')) {
      return { clean: false, signature: response.slice(0, -' FOUND'.length) };
    }
    throw new Error('ClamAV returned an invalid result: ' + response.slice(0, 200));
  }
}
