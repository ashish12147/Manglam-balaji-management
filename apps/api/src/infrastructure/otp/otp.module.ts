import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  OTP_DELIVERY_PROVIDER,
  type OtpDeliveryProvider,
} from '../../common/providers/otp-delivery.provider.js';
import type { AppEnvironment } from '../../config/env.schema.js';
import { DisabledOtpProvider } from './disabled-otp.provider.js';
import { Msg91OtpProvider } from './msg91-otp.provider.js';
import { TwilioOtpProvider } from './twilio-otp.provider.js';

@Global()
@Module({
  exports: [OTP_DELIVERY_PROVIDER],
  providers: [
    DisabledOtpProvider,
    Msg91OtpProvider,
    TwilioOtpProvider,
    {
      inject: [ConfigService, DisabledOtpProvider, Msg91OtpProvider, TwilioOtpProvider],
      provide: OTP_DELIVERY_PROVIDER,
      useFactory: (
        config: ConfigService<AppEnvironment, true>,
        disabled: DisabledOtpProvider,
        msg91: Msg91OtpProvider,
        twilio: TwilioOtpProvider,
      ): OtpDeliveryProvider => {
        const provider = config.get('OTP_PROVIDER', { infer: true });
        if (provider === 'disabled') return disabled;
        if (provider === 'msg91') return msg91;
        if (provider === 'twilio') return twilio;
        throw new Error('OTP_PROVIDER is not a supported delivery provider.');
      },
    },
  ],
})
export class OtpModule {}
