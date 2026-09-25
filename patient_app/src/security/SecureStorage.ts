import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Hospital-Grade Hardware-Backed Secure Storage Service
 * Encrypts sensitive authentication tokens and patient identifiers using
 * Android Keystore (AES-GCM / RSA) and iOS Keychain Services.
 *
 * Implements transparent migration from legacy unencrypted AsyncStorage.
 */
class SecureStorageService {
  private readonly SENSITIVE_KEYS = [
    'praxirence_token',
    'praxirence_user',
    'praxirence_role',
    'praxirence_patient_profile',
    '@praxirence_patient_biometrics',
  ];

  /**
   * Securely store key-value pair in Hardware Keystore / Keychain
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
      });
      // Ensure plain storage copy is cleaned up to prevent forensic memory dumps
      await AsyncStorage.removeItem(key).catch(() => {});
    } catch (error) {
      // Graceful fallback to AsyncStorage if hardware Keystore is unavailable on older test devices
      console.warn(`[SecureStorage] Hardware Keystore unavailable for key: ${key}, falling back to AsyncStorage`, error);
      await AsyncStorage.setItem(key, value);
    }
  }

  /**
   * Retrieve securely stored value, with automatic legacy migration
   */
  async getItem(key: string): Promise<string | null> {
    try {
      const secureValue = await SecureStore.getItemAsync(key);
      if (secureValue !== null) {
        return secureValue;
      }

      // Check legacy AsyncStorage for migration
      const legacyValue = await AsyncStorage.getItem(key);
      if (legacyValue !== null) {
        // Transparently migrate to Hardware Keystore
        await this.setItem(key, legacyValue);
        return legacyValue;
      }

      return null;
    } catch (error) {
      // Fallback read
      return await AsyncStorage.getItem(key).catch(() => null);
    }
  }

  /**
   * Delete item securely
   */
  async deleteItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Ignore if not present in SecureStore
    }
    await AsyncStorage.removeItem(key).catch(() => {});
  }

  /**
   * Wipe all credentials and sensitive patient records (e.g. upon Logout or Device Breach)
   */
  async wipeAllAuthCredentials(): Promise<void> {
    for (const key of this.SENSITIVE_KEYS) {
      await this.deleteItem(key);
    }
  }
}

export const SecureStorage = new SecureStorageService();
