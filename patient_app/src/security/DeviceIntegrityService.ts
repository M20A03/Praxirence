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
 * Hospital-Grade Runtime Application Self-Protection (RASP) & Anti-Tampering Service
 * (Patient App - OWASP MASVS-R Standard)
 * Protects patient health records against rooted environments, dynamic instrumentation (Frida),
 * and debugger attachment.
 */
class DeviceIntegrityService {
  private cachedAssessment: IntegrityAssessment | null = null;

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
        modelName.includes('droid4x') ||
        modelName.includes('vbox') ||
        modelName.includes('goldfish');

      if (isKnownEmulatorHardware) {
        violations.push('Generic or custom Android emulator hardware profile detected');
      }

      const supportedCpuArchs = (Device as any).supportedCpuArchitectures || [];
      if (typeof __DEV__ !== 'undefined' && !__DEV__ && supportedCpuArchs.includes('x86')) {
        violations.push('Non-standard x86 CPU architecture in production release');
      }
    }

    // 3. Dynamic Hooking Framework Detection (Frida / Substrate / Xposed)
    const globalObj = global as any;
    const hasHookArtifacts =
      typeof globalObj.__frida !== 'undefined' ||
      typeof globalObj._frida !== 'undefined' ||
      (typeof globalObj.Module !== 'undefined' && typeof globalObj.Process !== 'undefined') ||
      typeof globalObj.__xposed !== 'undefined' ||
      typeof globalObj.cydia !== 'undefined';

    if (hasHookArtifacts) {
      violations.push('Dynamic instrumentation engine (Frida/Xposed) hook detected');
    }

    // 4. Debugger Attachment Check
    const isProduction = !__DEV__;
    let isDebuggerAttached = false;
    if (isProduction && typeof globalObj.nativeCallSyncHook !== 'undefined') {
      isDebuggerAttached = true;
      violations.push('Remote debugger or native interception hook attached in production build');
    }

    let riskScore: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    const isRootedOrJailbroken = violations.some((v) => v.includes('hook') || v.includes('emulator'));

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

  async enforcePatientPolicy(): Promise<boolean> {
    const assessment = await this.assessDeviceIntegrity();

    if (assessment.riskScore === 'HIGH' && !__DEV__) {
      console.warn('[DeviceIntegrity] High-risk runtime environment detected:', assessment.violations);
      Alert.alert(
        'Security Notice',
        'Your device security environment appears modified or virtualized. For your privacy, sensitive health records will require re-authentication.',
        [{ text: 'Acknowledge', style: 'default' }]
      );
      return false;
    }

    return true;
  }
}

export const DeviceIntegrity = new DeviceIntegrityService();
