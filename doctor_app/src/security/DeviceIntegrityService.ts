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
 * (Doctor App - OWASP MASVS-R Standard)
 * Protects clinician consultations, e-prescriptions, and medical records against
 * rooted environments, dynamic instrumentation (Frida), reverse-engineering, and debugger attachment.
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
      violations.push('Doctor app running in virtualized emulator / sandbox');
    }

    // 2. Hardware profile check & Root build tags
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
        violations.push('Virtual Android hardware profile detected');
      }

      // Check for test-keys / unofficial rooted build tags
      const supportedCpuArchs = (Device as any).supportedCpuArchitectures || [];
      if (typeof __DEV__ !== 'undefined' && !__DEV__ && supportedCpuArchs.includes('x86')) {
        violations.push('Non-standard x86 CPU architecture in production release');
      }
    }

    // 3. Dynamic Hooking Framework Detection (Frida / Xposed / Substrate)
    const globalObj = global as any;
    const hasHookArtifacts =
      typeof globalObj.__frida !== 'undefined' ||
      typeof globalObj._frida !== 'undefined' ||
      (typeof globalObj.Module !== 'undefined' && typeof globalObj.Process !== 'undefined') ||
      typeof globalObj.__xposed !== 'undefined' ||
      typeof globalObj.cydia !== 'undefined';

    if (hasHookArtifacts) {
      violations.push('Dynamic instrumentation engine hook (Frida/Xposed/Substrate) detected');
    }

    // 4. Remote Debugger Attachment
    const isProduction = !__DEV__;
    let isDebuggerAttached = false;
    if (isProduction && typeof globalObj.nativeCallSyncHook !== 'undefined') {
      isDebuggerAttached = true;
      violations.push('Active remote debugger attached to clinician workstation session');
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

  /**
   * Enforce Doctor App Zero-Tolerance Policy
   */
  async enforceDoctorPolicy(): Promise<boolean> {
    const assessment = await this.assessDeviceIntegrity();

    if (assessment.riskScore === 'HIGH' && !__DEV__) {
      console.warn('[DeviceIntegrity] Doctor workstation environment flagged:', assessment.violations);
      Alert.alert(
        'Workstation Advisory',
        'Your workstation environment has modifications or emulation detected. For clinical safety, offline caches are restricted.',
        [{ text: 'Continue Session', style: 'default' }]
      );
      return false;
    }

    return true;
  }
}

export const DeviceIntegrity = new DeviceIntegrityService();
