import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Hospital-Grade Hardware-Backed Secure Storage Service (Doctor App)
 * Encrypts clinician authentication tokens, digital signatures, and session keys
 * using Android Keystore (AES-GCM / RSA) and iOS Keychain Services.
 */
class SecureStorageService {
  private readonly SENSITIVE_KEYS = [
    'praxirence_token',
    'praxirence_user',
    'praxirence_role',
    'praxirence_doctor_profile',
    '@praxirence_doctor_biometrics',
  ];

  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
      });
      await AsyncStorage.removeItem(key).catch(() => {});
    } catch (error) {
      console.warn(`[SecureStorage] Hardware Keystore unavailable for key: ${key}, falling back to AsyncStorage`, error);
      await AsyncStorage.setItem(key, value);
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const secureValue = await SecureStore.getItemAsync(key);
      if (secureValue !== null) {
        return secureValue;
      }

      const legacyValue = await AsyncStorage.getItem(key);
      if (legacyValue !== null) {
        await this.setItem(key, legacyValue);
        return legacyValue;
      }

      return null;
    } catch (error) {
      return await AsyncStorage.getItem(key).catch(() => null);
    }
  }

  async deleteItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Ignore if not present
    }
    await AsyncStorage.removeItem(key).catch(() => {});
  }

  async wipeAllAuthCredentials(): Promise<void> {
    for (const key of this.SENSITIVE_KEYS) {
      await this.deleteItem(key);
    }
  }
}

export const SecureStorage = new SecureStorageService();
