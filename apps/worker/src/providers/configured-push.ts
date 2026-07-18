import { WorkerConfigurationError } from '../errors.js';
import type { PushProvider, PushRequest } from './contracts.js';

export class ConfiguredPushProvider implements PushProvider {
  private readonly enabledProviders: ReadonlySet<PushRequest['provider']>;

  constructor(
    enabledProviders: ReadonlyArray<PushRequest['provider']>,
    private readonly delegate: PushProvider,
  ) {
    this.enabledProviders = new Set(enabledProviders);
  }

  async send(request: PushRequest): ReturnType<PushProvider['send']> {
    if (!this.enabledProviders.has(request.provider)) {
      throw new WorkerConfigurationError(
        `Push provider ${request.provider} is not configured for this worker.`,
      );
    }
    return this.delegate.send(request);
  }
}
