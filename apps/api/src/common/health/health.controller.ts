import { Controller, Get, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { HealthService } from './health.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @ApiOperation({ summary: 'Process liveness probe' })
  @ApiResponse({ status: HttpStatus.OK })
  liveness(): {
    status: 'ok';
    timestamp: string;
    uptimeSeconds: number;
    version: string;
  } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      version: process.env.APP_VERSION ?? 'unknown',
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Required dependency readiness probe' })
  @ApiResponse({ status: HttpStatus.OK })
  @ApiResponse({ status: HttpStatus.SERVICE_UNAVAILABLE })
  async readiness() {
    const report = await this.healthService.evaluateReadiness();

    if (report.status !== 'ok') {
      throw new ServiceUnavailableException({
        code: 'SERVICE_NOT_READY',
        details: { checks: report.checks },
        message: 'Required dependencies are unavailable.',
      });
    }

    return report;
  }
}
