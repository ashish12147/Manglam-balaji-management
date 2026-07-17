import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Manglam Balaji Resident',
  slug: 'manglam-balaji-resident',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'manglambalaji',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  ios: {
    bundleIdentifier: 'in.manglambalaji.resident',
    supportsTablet: true,
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: 'in.manglambalaji.resident',
    adaptiveIcon: {
      backgroundColor: '#F4F7F5',
    },
    permissions: ['POST_NOTIFICATIONS'],
  },
  web: {
    bundler: 'metro',
    output: 'static',
  },
  plugins: [
    'expo-router',
    ['expo-secure-store', { configureAndroidBackup: true }],
    ['expo-notifications', { defaultChannel: 'general', color: '#17443A' }],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Allow Manglam Balaji Resident to attach a photo you choose to a complaint.',
        cameraPermission:
          'Allow Manglam Balaji Resident to take a photo for a complaint attachment.',
      },
    ],
    ['expo-document-picker', { iCloudContainerEnvironment: 'Production' }],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? '',
    },
  },
};

export default config;
