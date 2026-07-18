import type {
  OtpDeliveryProvider,
  OtpDeliveryReceipt,
  OtpDeliveryRequest,
} from '../../common/providers/otp-delivery.provider.js';

export class OtpDeliveryDisabledError extends Error {
  constructor() {
    super('OTP delivery is disabled. Configure MSG91 or Twilio to deliver codes.');
    this.name = 'OTP_DELIVERY_DISABLED';
  }
}

export class DisabledOtpProvider implements OtpDeliveryProvider {
  send(_request: OtpDeliveryRequest): Promise<OtpDeliveryReceipt> {
    return Promise.reject(new OtpDeliveryDisabledError());
  }
}
