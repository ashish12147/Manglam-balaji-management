import { HttpException, type HttpStatus } from '@nestjs/common';

export interface ApiErrorOptions {
  code: string;
  details?: Record<string, unknown>;
  message: string;
  status: HttpStatus;
}

export class ApiError extends HttpException {
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(options: ApiErrorOptions) {
    super(options.message, options.status);
    this.code = options.code;
    this.details = options.details ?? {};
  }
}
