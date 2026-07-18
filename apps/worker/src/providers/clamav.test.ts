import { createServer, type Server, type Socket } from 'node:net';

import { describe, expect, it } from 'vitest';

import { ClamAvInstreamScanner } from './clamav.js';

const command = Buffer.from('zINSTREAM\0', 'utf8');

function decodeInstream(wire: Buffer): Buffer | null {
  if (wire.length < command.length) return null;
  if (!wire.subarray(0, command.length).equals(command)) {
    throw new Error('Unexpected ClamAV command framing.');
  }
  const chunks: Buffer[] = [];
  let offset = command.length;
  while (offset + 4 <= wire.length) {
    const size = wire.readUInt32BE(offset);
    offset += 4;
    if (size === 0) return Buffer.concat(chunks);
    if (offset + size > wire.length) return null;
    chunks.push(wire.subarray(offset, offset + size));
    offset += size;
  }
  return null;
}

function protocolServer(response: string, onPayload: (payload: Buffer) => void): Server {
  return createServer({ allowHalfOpen: true }, (socket) => {
    let responded = false;
    let wire = Buffer.alloc(0);
    socket.on('error', () => undefined);
    socket.once('end', () => {
      if (!responded) socket.destroy();
    });
    socket.on('data', (chunk: Buffer) => {
      if (responded) return;
      wire = Buffer.concat([wire, chunk]);
      let payload: Buffer | null;
      try {
        payload = decodeInstream(wire);
      } catch (error) {
        socket.destroy(error as Error);
        return;
      }
      if (!payload) return;
      responded = true;
      onPayload(payload);
      socket.end(Buffer.concat([Buffer.from(response, 'utf8'), Buffer.from([0])]));
    });
  });
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Test ClamAV server did not bind a TCP port.'));
        return;
      }
      resolve(address.port);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function* content(...chunks: string[]): AsyncIterable<Uint8Array> {
  for (const chunk of chunks) yield Buffer.from(chunk, 'utf8');
}

describe('ClamAvInstreamScanner', () => {
  it('uses null-terminated INSTREAM framing and accepts a clean result', async () => {
    let payload: Buffer | undefined;
    const server = protocolServer('stream: OK', (value) => {
      payload = value;
    });
    const port = await listen(server);
    try {
      const scanner = new ClamAvInstreamScanner('127.0.0.1', port, 1_000);
      await expect(scanner.scan(content('abc', '', 'def'))).resolves.toEqual({ clean: true });
      expect(payload?.toString('utf8')).toBe('abcdef');
    } finally {
      await close(server);
    }
  });

  it('returns the ClamAV signature for infected content', async () => {
    const server = protocolServer('stream: Win.Test.EICAR_HDB-1 FOUND', () => undefined);
    const port = await listen(server);
    try {
      const scanner = new ClamAvInstreamScanner('127.0.0.1', port, 1_000);
      await expect(scanner.scan(content('infected'))).resolves.toEqual({
        clean: false,
        signature: 'stream: Win.Test.EICAR_HDB-1',
      });
    } finally {
      await close(server);
    }
  });

  it('rejects malformed results and empty scan streams', async () => {
    const server = protocolServer('stream: UNKNOWN', () => undefined);
    const port = await listen(server);
    try {
      const scanner = new ClamAvInstreamScanner('127.0.0.1', port, 1_000);
      await expect(scanner.scan(content('payload'))).rejects.toThrow('invalid result');
      await expect(scanner.scan(content())).rejects.toThrow('empty');
    } finally {
      await close(server);
    }
  });

  it('rejects a timed-out ClamAV connection', async () => {
    let acceptedSocket: Socket | undefined;
    const server = createServer({ allowHalfOpen: true }, (socket) => {
      acceptedSocket = socket;
      socket.on('error', () => undefined);
      socket.resume();
    });
    const port = await listen(server);
    try {
      const scanner = new ClamAvInstreamScanner('127.0.0.1', port, 50);
      await expect(scanner.scan(content('payload'))).rejects.toThrow('timed out');
    } finally {
      acceptedSocket?.destroy();
      await close(server);
    }
  });
});
