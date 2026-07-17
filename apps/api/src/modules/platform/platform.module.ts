import { Module } from '@nestjs/common';

import { MutationJournalService } from './mutation-journal.service.js';
import { SensitivePayloadCipher } from './sensitive-payload-cipher.js';

@Module({
  exports: [MutationJournalService, SensitivePayloadCipher],
  providers: [MutationJournalService, SensitivePayloadCipher],
})
export class PlatformModule {}
