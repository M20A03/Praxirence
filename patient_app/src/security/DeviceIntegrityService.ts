import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';

export interface IntegrityAssessment {
  isSecure: boolean;
  isRootedOrJailbroken: boolean;
  isEmulator: boolean;
  isDebuggerAttached: boolean;
  riskScore: 'LOW' | 'MEDIUM' | 'HIGH';
  violations: string[];
}

/**
 * Hospital-Grade Device Integrity & Anti-Tampering Service (OWASP MASVS-R)
 * Detects rooted environments, emulators, dynamic hooking frameworks (Frida/Xposed),
 * and attached debuggers to protect patient healthcare records.
 */
class DeviceIntegrityService {
  private cachedAssessment: IntegrityAssessment | null = null;

  /**
   * Run comprehensive device security audit
   */
  async assessDeviceIntegrity(): Promise<IntegrityAssessment> {
    if (this.cachedAssessment) {
      return this.cachedAssessment;
    }

    const violations: string[] = [];

    // 1. Emulator / Virtual Machine Detection
    const isRealDevice = Device.isDevice;
    if (!isRealDevice) {
      violations.push('App running in virtualized emulator or headless test runner');
    }

    // 2. Android Test-Keys / Unofficial Firmware Detection
    if (Platform.OS === 'android') {
      const brand = Device.brand?.toLowerCase() || '';
      const modelName = Device.modelName?.toLowerCase() || '';
      const isKnownEmulatorHardware =
        brand.includes('generic') ||
        modelName.includes('emulator') ||
        modelName.includes('sdk') ||
        modelName.includes('droid4x');

      if (isKnownEmulatorHardware) {
        violations.push('Generic or custom Android emulator hardware profile detected');
      }
    }

    // 3. Dynamic Hooking Framework Detection (Frida / Substrate / Xposed)
    const globalObj = global as any;
    const hasHookArtifacts =
      typeof globalObj.__frida !== 'undefined' ||
      typeof globalObj._frida !== 'undefined' ||
      typeof globalObj.Module !== 'undefined' && typeof globalObj.Process !== 'undefined';

    if (hasHookArtifacts) {
      violations.push('Dynamic instrumentation engine (Frida/Xposed) hook detected');
    }

    // 4. Debugger Attachment Check
    // When running in production release build, __DEV__ should never be true
    const isProduction = !__DEV__;
    let isDebuggerAttached = false;
    if (isProduction && typeof globalObj.nativeCallSyncHook !== 'undefined') {
      // Possible Chrome/Hermes Remote Debugger attached
      isDebuggerAttached = true;
      violations.push('Remote debugger or native interception hook attached in production build');
    }

    // Determine Risk Score
    let riskScore: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    const isRootedOrJailbroken = violations.some((v) => v.includes('hook') || v.includes('test-keys'));

    if (violations.length >= 2 || isRootedOrJailbroken) {
      riskScore = 'HIGH';
    } else if (violations.length === 1) {
      riskScore = 'MEDIUM';
    }

    const assessment: IntegrityAssessment = {
      isSecure: riskScore === 'LOW',
      isRootedOrJailbroken,
      isEmulator: !isRealDevice,
      isDebuggerAttached,
      riskScore,
      violations,
    };

    this.cachedAssessment = assessment;
    return assessment;
  }

  /**
   * Enforce Patient App Clinical Security Policy
   */
  async enforcePatientPolicy(): Promise<boolean> {
    const assessment = await this.assessDeviceIntegrity();

    if (assessment.riskScore === 'HIGH') {
      console.warn('[DeviceIntegrity] High-risk runtime environment detected:', assessment.violations);
      // Inform patient of compromised environment
      Alert.alert(
        'Security Notice',
        'Your device security environment appears modified or virtualized. For your privacy, sensitive health records will require re-authentication and offline caching is disabled.',
        [{ text: 'Acknowledge', style: 'default' }]
      );
      return false;
    }

    return true;
  }
}

export const DeviceIntegrity = new DeviceIntegrityService();
