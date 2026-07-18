import type {
  PushDeliveryReceipt,
  PushNotificationMessage,
  PushNotificationProvider,
} from '../../common/providers/notification.provider.js';

export class PushDeliveryDisabledError extends Error {
  constructor() {
    super('Push delivery is disabled. Configure Expo or FCM to deliver notifications.');
    this.name = 'PUSH_DELIVERY_DISABLED';
  }
}

export class DisabledPushProvider implements PushNotificationProvider {
  send(_message: PushNotificationMessage): Promise<PushDeliveryReceipt> {
    return Promise.reject(new PushDeliveryDisabledError());
  }
}
