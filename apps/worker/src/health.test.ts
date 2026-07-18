import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { startHealthServer } from './health.js';
import type { WorkerRuntime } from './runtime.js';

let server: Awaited<ReturnType<typeof startHealthServer>> | undefined;

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) =>
    server?.close((error) => (error ? reject(error) : resolve())),
  );
  server = undefined;
});

describe('worker health server', () => {
  it('binds all container interfaces and exposes canonical liveness', async () => {
    server = await startHealthServer(0, { isHealthy: false } as WorkerRuntime);
    const address = server.address() as AddressInfo;

    expect(address.address).toBe('0.0.0.0');
    const response = await fetch(`http://127.0.0.1:${address.port}/health/live`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'live' });
  });

  it('reports database polling and heartbeat state through readiness', async () => {
    server = await startHealthServer(0, { isHealthy: false } as WorkerRuntime);
    const address = server.address() as AddressInfo;
    const unavailable = await fetch(`http://127.0.0.1:${address.port}/health/ready`);

    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toEqual({ status: 'not_ready' });

    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server?.close((error) => (error ? reject(error) : resolve())),
    );
    server = await startHealthServer(0, { isHealthy: true } as WorkerRuntime);
    const readyAddress = server.address() as AddressInfo;
    const available = await fetch(`http://127.0.0.1:${readyAddress.port}/health/ready`);
    expect(available.status).toBe(200);
    expect(await available.json()).toEqual({ status: 'ready' });
  });

  it('serves valid Prometheus text and rejects legacy aliases', async () => {
    server = await startHealthServer(0, { isHealthy: true } as WorkerRuntime);
    const address = server.address() as AddressInfo;

    const metrics = await fetch(`http://127.0.0.1:${address.port}/metrics`);
    expect(metrics.status).toBe(200);
    expect(metrics.headers.get('content-type')).toContain('text/plain');
    expect(await metrics.text()).toContain('manglam_worker_ready 1');

    expect((await fetch(`http://127.0.0.1:${address.port}/live`)).status).toBe(404);
    expect((await fetch(`http://127.0.0.1:${address.port}/ready`)).status).toBe(404);
  });
});
