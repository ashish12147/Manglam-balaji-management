import { createServer } from 'node:http';

import type { WorkerRuntime } from './runtime.js';

export function startHealthServer(
  port: number,
  runtime: WorkerRuntime,
): Promise<ReturnType<typeof createServer>> {
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;

    if (path === '/health/live') {
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': 'application/json',
      });
      response.end(JSON.stringify({ status: 'live' }));
      return;
    }

    if (path === '/health/ready') {
      const ready = runtime.isHealthy;
      response.writeHead(ready ? 200 : 503, {
        'cache-control': 'no-store',
        'content-type': 'application/json',
      });
      response.end(JSON.stringify({ status: ready ? 'ready' : 'not_ready' }));
      return;
    }

    if (path === '/metrics') {
      const ready = runtime.isHealthy ? 1 : 0;
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': 'text/plain; version=0.0.4; charset=utf-8',
      });
      response.end(
        `# HELP manglam_worker_ready Whether the worker can reach its authoritative PostgreSQL outbox.\n# TYPE manglam_worker_ready gauge\nmanglam_worker_ready ${ready}\n`,
      );
      return;
    }

    response.writeHead(404).end();
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => resolve(server));
  });
}
