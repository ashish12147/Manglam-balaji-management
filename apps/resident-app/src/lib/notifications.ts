import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { errorMessage } from '@/lib/api';
import { notificationApi } from '@/lib/resident-api';
import { getOrCreateDeviceId } from '@/lib/storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function notificationRoute(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const route = (data as { deepLink?: unknown }).deepLink;
  return typeof route === 'string' && route.startsWith('/') ? route : null;
}

export async function registerForNotifications(): Promise<{ error?: string; registered: boolean }> {
  if (Platform.OS === 'web') return { registered: false };
  if (!Device.isDevice)
    return { error: 'Push notifications require a physical device.', registered: false };

  const current = await Notifications.getPermissionsAsync();
  const permission =
    current.status === 'granted' ? current : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') {
    return { error: 'Notification permission was not granted.', registered: false };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('general', {
      importance: Notifications.AndroidImportance.DEFAULT,
      name: 'General updates',
    });
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync();
    await notificationApi.registerPushEndpoint({
      deviceId: await getOrCreateDeviceId(),
      platform: Platform.OS,
      provider: 'EXPO',
      token: token.data,
    });
    return { registered: true };
  } catch (error) {
    return { error: errorMessage(error), registered: false };
  }
}
