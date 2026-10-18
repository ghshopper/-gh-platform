import type { ExpoConfig } from 'expo/config';

// The App Store listing (id 6801456059) and Firebase are registered under
// these identifiers, so the new app must keep them to ship as an update.
const IOS_BUNDLE_ID = 'com.example.ghShopper';
const ANDROID_PACKAGE = 'com.example.gh_shopper';

const config: ExpoConfig = {
  name: 'GH Shopper',
  slug: 'gh-shopper',
  scheme: 'ghshopper',
  version: '2.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: IOS_BUNDLE_ID,
    buildNumber: process.env.BUILD_NUMBER ?? '1',
    // The App Store version also ran on iPad, so updates must keep iPad.
    supportsTablet: true,
    googleServicesFile: './GoogleService-Info.plist',
    infoPlist: {
      CFBundleDevelopmentRegion: 'ar',
      CFBundleLocalizations: ['ar', 'en'],
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: 'لتصوير القطعة اللي تبي نطلبها لك',
      NSPhotoLibraryUsageDescription: 'لاختيار صورة القطعة اللي تبي نطلبها لك',
      NSLocationWhenInUseUsageDescription: 'لتحديد موقع التوصيل على الخريطة',
      UIBackgroundModes: ['remote-notification'],
      UIRequiresFullScreen: true,
    },
    entitlements: {
      'aps-environment': 'production',
      'com.apple.developer.in-app-payments': ['merchant.com.ghshopper.app'],
    },
  },
  android: {
    package: ANDROID_PACKAGE,
    versionCode: Number(process.env.BUILD_NUMBER ?? 1),
    googleServicesFile: './google-services.json',
    adaptiveIcon: { foregroundImage: './assets/icon.png', backgroundColor: '#5A0F1C' },
    permissions: ['CAMERA', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'POST_NOTIFICATIONS'],
  },
  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-splash-screen',
      { image: './assets/logo.png', imageWidth: 150, backgroundColor: '#FFFFFF' },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'لاختيار صورة القطعة اللي تبي نطلبها لك',
        cameraPermission: 'لتصوير القطعة اللي تبي نطلبها لك',
      },
    ],
    [
      'expo-location',
      { locationWhenInUsePermission: 'لتحديد موقع التوصيل على الخريطة' },
    ],
    '@react-native-firebase/app',
    '@react-native-firebase/messaging',
    [
      'expo-build-properties',
      {
        ios: { useFrameworks: 'static', deploymentTarget: '16.4' },
        android: { minSdkVersion: 24 },
      },
    ],
    './plugins/withAmwalPay',
    './plugins/withFirebaseSetup',
  ],
  experiments: { typedRoutes: false },
  extra: { apiBase: 'https://ghshopper.com/api', siteBase: 'https://ghshopper.com' },
};

export default config;
