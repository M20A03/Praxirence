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
      console.log('Must use physical device for real push notifications');
      return 'emulator_mock_token_123';
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync()).data;
    return token;
  } catch (err) {
    console.log('Notification registration notice:', err);
    return null;
  }
}
