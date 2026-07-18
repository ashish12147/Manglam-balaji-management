export class WorkerConfigurationError extends Error {
  readonly code = 'WORKER_CONFIGURATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'WorkerConfigurationError';
  }
}
