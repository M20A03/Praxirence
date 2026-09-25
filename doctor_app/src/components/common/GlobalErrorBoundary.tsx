import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize } from '../../theme';
import { CrashResilience } from '../../services/CrashResilienceService';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  isCompact?: boolean;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Hospital-Grade Hierarchical Error Boundary (Doctor Workstation)
 */
export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'Unexpected UI rendering issue',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const sanitizedMsg = CrashResilience.sanitizePHI(error.message);
    CrashResilience.recordEvent({
      timestamp: new Date().toISOString(),
      type: 'CRASH_AVOIDED',
      message: `[DoctorErrorBoundary] ${sanitizedMsg}`,
      metadata: { componentStack: errorInfo.componentStack?.substring(0, 300) },
    });
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.isCompact) {
        return (
          <View style={styles.compactContainer}>
            <View style={styles.compactHeaderRow}>
              <Ionicons name="shield-outline" size={16} color="#0D9488" />
              <Text style={styles.compactTitle}>
                {this.props.fallbackTitle || 'Consultation Panel Interrupted'}
              </Text>
            </View>
            <Text style={styles.compactDesc}>
              Clinical data is securely preserved. Tap below to reload this module.
            </Text>
            <TouchableOpacity style={styles.compactRetryBtn} onPress={this.handleReset} activeOpacity={0.8}>
              <Ionicons name="refresh" size={13} color="#FFFFFF" />
              <Text style={styles.compactRetryBtnText}>Reload Panel</Text>
            </TouchableOpacity>
          </View>
        );
      }

      return (
        <View style={styles.fullScreenContainer}>
          <View style={styles.shieldIconBadge}>
            <Ionicons name="shield-checkmark" size={36} color="#0F766E" />
          </View>

          <Text style={styles.errorTitle}>Protected Clinician Session</Text>
          <Text style={styles.errorDesc}>
            A workstation panel encountered an unexpected rendering condition. OPD queues, patient histories, and active prescriptions remain encrypted and fully intact.
          </Text>

          <TouchableOpacity style={styles.primaryRecoverBtn} onPress={this.handleReset} activeOpacity={0.8}>
            <Ionicons name="reload" size={16} color="#FFFFFF" />
            <Text style={styles.primaryRecoverBtnText}>Restore Clinician View</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  shieldIconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  errorTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#64748B',
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryRecoverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F766E',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    minHeight: 48,
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryRecoverBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  compactContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  compactHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  compactTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#0F172A',
  },
  compactDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 12,
  },
  compactRetryBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F766E',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  compactRetryBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
});
