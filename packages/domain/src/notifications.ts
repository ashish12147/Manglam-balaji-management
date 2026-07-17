import {
  NotificationCategory,
  NotificationChannel,
  type NotificationCategory as NotificationCategoryType,
  type NotificationChannel as NotificationChannelType,
} from '@manglam/types';

export type NotificationCriticality = 'MANDATORY_CRITICAL' | 'TIME_SENSITIVE' | 'OPTIONAL';

export interface NotificationRule {
  readonly criticality: NotificationCriticality;
  readonly preferenceMutable: boolean;
  readonly defaultChannels: readonly NotificationChannelType[];
  readonly maxDeliveryAttempts: number;
  readonly baseRetryMs: number;
  readonly maxRetryMs: number;
}

export const NOTIFICATION_RULES: Readonly<Record<NotificationCategoryType, NotificationRule>> =
  Object.freeze({
    SECURITY_CRITICAL: {
      criticality: 'MANDATORY_CRITICAL',
      preferenceMutable: false,
      defaultChannels: [
        NotificationChannel.IN_APP,
        NotificationChannel.PUSH,
        NotificationChannel.REALTIME,
      ],
      maxDeliveryAttempts: 8,
      baseRetryMs: 2_000,
      maxRetryMs: 5 * 60_000,
    },
    EMERGENCY: {
      criticality: 'MANDATORY_CRITICAL',
      preferenceMutable: false,
      defaultChannels: [
        NotificationChannel.IN_APP,
        NotificationChannel.PUSH,
        NotificationChannel.REALTIME,
      ],
      maxDeliveryAttempts: 10,
      baseRetryMs: 1_000,
      maxRetryMs: 2 * 60_000,
    },
    VISITOR_APPROVAL: {
      criticality: 'TIME_SENSITIVE',
      preferenceMutable: false,
      defaultChannels: [
        NotificationChannel.IN_APP,
        NotificationChannel.PUSH,
        NotificationChannel.REALTIME,
      ],
      maxDeliveryAttempts: 6,
      baseRetryMs: 2_000,
      maxRetryMs: 60_000,
    },
    VISITOR_ACTIVITY: {
      criticality: 'OPTIONAL',
      preferenceMutable: true,
      defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      maxDeliveryAttempts: 5,
      baseRetryMs: 5_000,
      maxRetryMs: 10 * 60_000,
    },
    NOTICE: {
      criticality: 'OPTIONAL',
      preferenceMutable: true,
      defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      maxDeliveryAttempts: 5,
      baseRetryMs: 10_000,
      maxRetryMs: 15 * 60_000,
    },
    COMPLAINT: {
      criticality: 'OPTIONAL',
      preferenceMutable: true,
      defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      maxDeliveryAttempts: 5,
      baseRetryMs: 10_000,
      maxRetryMs: 15 * 60_000,
    },
    PAYMENT: {
      criticality: 'OPTIONAL',
      preferenceMutable: true,
      defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      maxDeliveryAttempts: 5,
      baseRetryMs: 10_000,
      maxRetryMs: 15 * 60_000,
    },
    GENERAL: {
      criticality: 'OPTIONAL',
      preferenceMutable: true,
      defaultChannels: [NotificationChannel.IN_APP],
      maxDeliveryAttempts: 3,
      baseRetryMs: 30_000,
      maxRetryMs: 30 * 60_000,
    },
  });

export const isNotificationPreferenceMutable = (category: NotificationCategoryType): boolean =>
  NOTIFICATION_RULES[category].preferenceMutable;

export interface ResolvedNotificationDelivery {
  readonly channels: readonly NotificationChannelType[];
  readonly preferenceOverridden: boolean;
  readonly requiresInAppFallback: true;
}

export const resolveNotificationDelivery = (input: {
  readonly category: NotificationCategoryType;
  readonly preferredChannels: readonly NotificationChannelType[];
  readonly availableChannels: readonly NotificationChannelType[];
}): ResolvedNotificationDelivery => {
  const rule = NOTIFICATION_RULES[input.category];
  const requested = rule.preferenceMutable ? input.preferredChannels : rule.defaultChannels;
  const available = new Set(input.availableChannels);
  const channels = new Set<NotificationChannelType>([NotificationChannel.IN_APP]);

  for (const channel of requested) {
    if (channel === NotificationChannel.IN_APP || available.has(channel)) {
      channels.add(channel);
    }
  }

  return {
    channels: [...channels],
    preferenceOverridden:
      (!rule.preferenceMutable &&
        input.preferredChannels.some((channel) => !rule.defaultChannels.includes(channel))) ||
      (!rule.preferenceMutable &&
        rule.defaultChannels.some((channel) => !input.preferredChannels.includes(channel))),
    requiresInAppFallback: true,
  };
};

export const notificationRetryDelayMs = (
  category: NotificationCategoryType,
  attempt: number,
): number | null => {
  const rule = NOTIFICATION_RULES[category];
  if (!Number.isSafeInteger(attempt) || attempt < 1 || attempt >= rule.maxDeliveryAttempts)
    return null;
  return Math.min(rule.baseRetryMs * 2 ** (attempt - 1), rule.maxRetryMs);
};

export const mandatoryNotificationCategories: readonly NotificationCategoryType[] = Object.freeze([
  NotificationCategory.SECURITY_CRITICAL,
  NotificationCategory.EMERGENCY,
  NotificationCategory.VISITOR_APPROVAL,
]);
