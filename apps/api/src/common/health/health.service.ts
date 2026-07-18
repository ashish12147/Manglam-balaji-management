import { Injectable } from '@nestjs/common';

export interface ReadinessCheckResult {
  details?: Record<string, unknown>;
  healthy: boolean;
  name: string;
}

export interface ReadinessCheck {
  check(): Promise<ReadinessCheckResult>;
  readonly name: string;
}

export interface ReadinessReport {
  checks: ReadinessCheckResult[];
  status: 'ok' | 'unavailable';
}

const requiredChecks = ['database', 'redis'] as const;

@Injectable()
export class HealthService {
  private readonly checks = new Map<string, ReadinessCheck>();

  register(check: ReadinessCheck): void {
    if (this.checks.has(check.name)) {
      throw new Error(`Readiness check "${check.name}" is already registered.`);
    }

    this.checks.set(check.name, check);
  }

  async evaluateReadiness(): Promise<ReadinessReport> {
    const results = await Promise.all(
      requiredChecks.map(async (name): Promise<ReadinessCheckResult> => {
        const check = this.checks.get(name);

        if (!check) {
          return {
            details: { reason: 'check_not_registered' },
            healthy: false,
            name,
          };
        }

        try {
          return await check.check();
        } catch {
          return {
            details: { reason: 'check_failed' },
            healthy: false,
            name,
          };
        }
      }),
    );

    return {
      checks: results,
      status: results.every((result) => result.healthy) ? 'ok' : 'unavailable',
    };
  }
}
