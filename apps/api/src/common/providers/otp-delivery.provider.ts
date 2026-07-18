export const OTP_DELIVERY_PROVIDER = Symbol('OTP_DELIVERY_PROVIDER');

export interface OtpDeliveryRequest {
  challengeId: string;
  expiresAt: Date;
  phoneE164: string;
  plaintextCode: string;
  purpose: 'SIGN_IN' | 'PHONE_CHANGE' | 'PIN_RESET' | 'STEP_UP';
}

export interface OtpDeliveryReceipt {
  providerMessageId: string;
  queuedAt: Date;
}

export interface OtpDeliveryProvider {
  send(request: OtpDeliveryRequest): Promise<OtpDeliveryReceipt>;
}
