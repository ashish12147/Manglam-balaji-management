export const PUSH_NOTIFICATION_PROVIDER = Symbol('PUSH_NOTIFICATION_PROVIDER');

export interface PushNotificationMessage {
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
  recipientEndpoint: string;
  title: string;
}

export interface PushDeliveryReceipt {
  accepted: boolean;
  providerMessageId?: string;
  terminalFailureReason?: 'ENDPOINT_EXPIRED' | 'ENDPOINT_INVALID';
}

export interface PushNotificationProvider {
  send(message: PushNotificationMessage): Promise<PushDeliveryReceipt>;
}
