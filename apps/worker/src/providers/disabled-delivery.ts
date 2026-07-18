import { WorkerConfigurationError } from '../errors.js';
import type { OtpDeliveryProvider, OtpDeliveryRequest } from './contracts.js';
import { ExpoReceiptProvider, type ExpoReceiptStatus } from './expo.js';

export class DisabledOtpDeliveryProvider implements OtpDeliveryProvider {
  async send(_request: OtpDeliveryRequest): Promise<{ providerMessageId: string }> {
    throw new WorkerConfigurationError('OTP delivery is explicitly disabled for this worker.');
  }
}

export class DisabledExpoReceiptProvider extends ExpoReceiptProvider {
  constructor() {
    super('', 500);
  }

  override async get(_ticketId: string): Promise<ExpoReceiptStatus> {
    throw new WorkerConfigurationError(
      'Expo receipt processing is not configured for this worker.',
    );
  }
}
