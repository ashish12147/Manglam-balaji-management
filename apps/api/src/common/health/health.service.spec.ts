import { describe, expect, it } from 'vitest';

import { HealthService, type ReadinessCheck } from './health.service.js';

function check(name: string, healthy: boolean): ReadinessCheck {
  return {
    name,
    check: async () => ({ healthy, name }),
  };
}

describe('HealthService', () => {
  it('fails closed while required dependency checks are not registered', async () => {
    const service = new HealthService();

    await expect(service.evaluateReadiness()).resolves.toMatchObject({
      status: 'unavailable',
      checks: [
        { healthy: false, name: 'database' },
        { healthy: false, name: 'redis' },
      ],
    });
  });

  it('reports ready only when every required dependency is healthy', async () => {
    const service = new HealthService();
    service.register(check('database', true));
    service.register(check('redis', true));

    await expect(service.evaluateReadiness()).resolves.toMatchObject({
      status: 'ok',
    });
  });

  it('reports unavailable when a dependency check throws', async () => {
    const service = new HealthService();
    service.register(check('database', true));
    service.register({
      name: 'redis',
      check: async () => {
        throw new Error('Redis is unavailable.');
      },
    });

    await expect(service.evaluateReadiness()).resolves.toMatchObject({
      status: 'unavailable',
    });
  });

  it('rejects duplicate check registration', () => {
    const service = new HealthService();
    service.register(check('database', true));

    expect(() => service.register(check('database', true))).toThrow(/already registered/);
  });
});
