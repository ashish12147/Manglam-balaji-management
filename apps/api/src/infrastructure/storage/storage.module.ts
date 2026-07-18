import { Global, Module } from '@nestjs/common';

import { PRIVATE_FILE_STORAGE_PROVIDER } from '../../common/providers/private-file-storage.provider.js';
import { S3FileStorageService } from './s3-file-storage.service.js';

@Global()
@Module({
  exports: [PRIVATE_FILE_STORAGE_PROVIDER, S3FileStorageService],
  providers: [
    S3FileStorageService,
    {
      provide: PRIVATE_FILE_STORAGE_PROVIDER,
      useExisting: S3FileStorageService,
    },
  ],
})
export class StorageModule {}
