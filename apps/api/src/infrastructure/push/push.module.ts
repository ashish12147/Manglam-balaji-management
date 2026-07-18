import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  PUSH_NOTIFICATION_PROVIDER,
  type PushNotificationProvider,
} from '../../common/providers/notification.provider.js';
import type { AppEnvironment } from '../../config/env.schema.js';
import { DisabledPushProvider } from './disabled-push.provider.js';
import { ExpoPushProvider } from './expo-push.provider.js';
import { FcmPushProvider } from './fcm-push.provider.js';

@Global()
@Module({
  exports: [PUSH_NOTIFICATION_PROVIDER],
  providers: [
    DisabledPushProvider,
    ExpoPushProvider,
    FcmPushProvider,
    {
      inject: [ConfigService, DisabledPushProvider, ExpoPushProvider, FcmPushProvider],
      provide: PUSH_NOTIFICATION_PROVIDER,
      useFactory: (
        config: ConfigService<AppEnvironment, true>,
        disabled: DisabledPushProvider,
        expo: ExpoPushProvider,
        fcm: FcmPushProvider,
      ): PushNotificationProvider => {
        const provider = config.get('PUSH_PROVIDER', { infer: true });
        if (provider === 'disabled') return disabled;
        if (provider === 'expo') return expo;
        if (provider === 'fcm') return fcm;
        throw new Error('PUSH_PROVIDER is not a supported delivery provider.');
      },
    },
  ],
})
export class PushModule {}
