import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { redactSensitiveValues } from '../security/redaction.js';
import { ApiError } from './api-error.js';
import type { RequestWithCorrelationId } from './correlation-id.middleware.js';

interface NestErrorResponse {
  code?: unknown;
  details?: unknown;
  error?: unknown;
  message?: unknown;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithCorrelationId>();
    const response = context.getResponse();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const normalized = this.normalizeException(exception, status);
    const correlationId = request.correlationId;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const diagnostic = redactSensitiveValues({
        correlationId,
        exception:
          exception instanceof Error
            ? { message: exception.message, name: exception.name }
            : { name: 'UnknownError' },
      });
      this.logger.error(JSON.stringify(diagnostic));
    }

    this.adapterHost.httpAdapter.reply(
      response,
      {
        error: {
          code: normalized.code,
          correlationId,
          details: normalized.details,
          message: normalized.message,
        },
      },
      status,
    );
  }

  private normalizeException(
    exception: unknown,
    status: number,
  ): { code: string; details: Record<string, unknown>; message: string } {
    if (exception instanceof ApiError) {
      return {
        code: exception.code,
        details: exception.details,
        message: exception.message,
      };
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const body: NestErrorResponse =
        typeof response === 'object' && response !== null ? response : { message: response };

      return {
        code: typeof body.code === 'string' ? body.code : `HTTP_${status}`,
        details:
          typeof body.details === 'object' && body.details !== null
            ? (body.details as Record<string, unknown>)
            : {},
        message: this.publicMessage(body.message, exception.message, status),
      };
    }

    return {
      code: 'INTERNAL_SERVER_ERROR',
      details: {},
      message: 'An unexpected error occurred.',
    };
  }

  private publicMessage(responseMessage: unknown, fallback: string, status: number): string {
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return 'An unexpected error occurred.';
    }

    if (typeof responseMessage === 'string') {
      return responseMessage;
    }

    if (
      Array.isArray(responseMessage) &&
      responseMessage.every((item) => typeof item === 'string')
    ) {
      return 'The request contains invalid values.';
    }

    return fallback;
  }
}
