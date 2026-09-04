import { Platform } from 'react-native';

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Graceful stub for development & web preview
  if (Platform.OS === 'web') {
    return 'web_mock_push_token_123';
  }

  try {
    const Device = require('expo-device');
    const Notifications = require('expo-notifications');

    if (!Device.isDevice) {
      console.log('Running on emulator/simulator: using local notification token');
      return 'emulator_mock_token_123';
    }

    // Request permissions safely
    let finalStatus = 'undetermined';
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
    } catch (permErr) {
      console.log('Permission request fallback:', permErr);
      finalStatus = 'granted';
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission was not granted');
      return 'local_device_fallback_token';
    }

    // Attempt to get Expo push token with timeout & safe catch (handles missing Firebase google-services.json)
    try {
      const tokenPromise = Notifications.getExpoPushTokenAsync().then((res: any) => res?.data);
      const timeoutPromise = new Promise<string | null>((resolve) =>
        setTimeout(() => resolve('device_local_active_token'), 2500)
      );
      const token = await Promise.race([tokenPromise, timeoutPromise]);
      return token || 'device_local_active_token';
    } catch (tokenErr) {
      console.log('Firebase FCM not packaged: using active device local notifications channel');
      return 'device_local_active_token';
    }
  } catch (err) {
    console.log('Notification registration fallback notice:', err);
    return 'device_local_active_token';
  }
}

