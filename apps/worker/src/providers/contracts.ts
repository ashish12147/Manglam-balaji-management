export interface OtpDeliveryRequest {
  challengeId: string;
  expiresAt: Date;
  phoneE164: string;
  plaintextCode: string;
  purpose: 'SIGN_IN' | 'PHONE_CHANGE' | 'PIN_RESET' | 'STEP_UP';
}

export interface OtpDeliveryProvider {
  send(request: OtpDeliveryRequest): Promise<{ providerMessageId: string }>;
}

export interface PushRequest {
  body: string;
  category:
    | 'SECURITY_CRITICAL'
    | 'VISITOR_APPROVAL'
    | 'VISITOR_ACTIVITY'
    | 'EMERGENCY'
    | 'NOTICE'
    | 'COMPLAINT'
    | 'PAYMENT'
    | 'GENERAL';
  data: Record<string, string>;
  dedupeKey: string;
  provider: 'EXPO' | 'FCM';
  recipientEndpoint: string;
  title: string;
}

export interface PushProvider {
  send(request: PushRequest): Promise<{
    accepted: boolean;
    providerMessageId?: string;
    terminalFailureReason?: 'ENDPOINT_EXPIRED' | 'ENDPOINT_INVALID';
  }>;
}

export interface FileObject {
  checksumSha256: string | null;
  contentLength: number;
  contentType: string | null;
}

export interface PrivateObjectStore {
  copy(sourceKey: string, destinationKey: string): Promise<void>;
  deletePrivate(key: string, societyId: string): Promise<void>;
  deleteQuarantine(key: string): Promise<void>;
  inspect(key: string): Promise<FileObject>;
  read(key: string): AsyncIterable<Uint8Array>;
}

export interface MalwareScanner {
  scan(content: AsyncIterable<Uint8Array>): Promise<{ clean: boolean; signature?: string }>;
}
