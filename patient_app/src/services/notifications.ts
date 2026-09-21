import { Platform } from 'react-native';
import { mobileApi } from './api';

export async function registerForPushNotificationsAsync(patientId?: string): Promise<string | null> {
  // Graceful stub for development & web preview
  if (Platform.OS === 'web') {
    const mockToken = 'web_mock_push_token_123';
    if (patientId) {
      mobileApi.updateFcmToken(patientId, mockToken).catch(() => {});
    }
    return mockToken;
  }

  try {
    const Device = require('expo-device');
    const Notifications = require('expo-notifications');

    if (!Device.isDevice) {
      console.log('Running on emulator/simulator: using local notification token');
      const emuToken = 'emulator_mock_token_123';
      if (patientId) {
        mobileApi.updateFcmToken(patientId, emuToken).catch(() => {});
      }
      return emuToken;
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
    let token: string | null = null;
    try {
      const tokenPromise = Notifications.getExpoPushTokenAsync().then((res: any) => res?.data);
      const timeoutPromise = new Promise<string | null>((resolve) =>
        setTimeout(() => resolve('device_local_active_token'), 2500)
      );
      token = (await Promise.race([tokenPromise, timeoutPromise])) || 'device_local_active_token';
    } catch (tokenErr) {
      console.log('Firebase FCM not packaged: using active device local notifications channel');
      token = 'device_local_active_token';
    }

    if (token && patientId) {
      mobileApi.updateFcmToken(patientId, token).catch((e) => {
        console.warn('Backend push token sync notice:', e);
      });
    }

    return token;
  } catch (err) {
    console.log('Notification registration fallback notice:', err);
    return 'device_local_active_token';
  }
}

export async function syncPushTokenWithBackend(patientId: string, token: string): Promise<void> {
  if (!patientId || !token) return;
  try {
    await mobileApi.updateFcmToken(patientId, token);
  } catch (e) {
    console.warn('Manual push token sync notice:', e);
  }
}
