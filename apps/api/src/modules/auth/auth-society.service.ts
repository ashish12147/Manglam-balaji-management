import { HttpStatus, Injectable } from '@nestjs/common';
import { RecordStatus } from '@manglam/database';

import { ApiError } from '../../common/http/api-error.js';
import { DatabaseService } from '../../infrastructure/database/database.service.js';

@Injectable()
export class AuthSocietyService {
  constructor(private readonly database: DatabaseService) {}

  async activeId(): Promise<string> {
    const society = await this.database.client.society.findFirst({
      select: { id: true },
      where: {
        singletonKey: 'MANGLAM_BALAJI',
        status: RecordStatus.ACTIVE,
      },
    });
    if (!society) {
      throw new ApiError({
        code: 'SERVICE_NOT_CONFIGURED',
        details: {},
        message: 'Authentication is not available.',
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    }
    return society.id;
  }
}
