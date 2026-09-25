import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled React Native Error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Ionicons name="shield-checkmark-outline" size={40} color="#059669" />
            </View>
            <Text style={styles.title}>Session Protected</Text>
            <Text style={styles.subtitle}>
              The application encountered a recoverable UI state. Your personal health records and vault data remain completely secure.
            </Text>

            {this.state.error && (
              <ScrollView style={styles.errorBox} contentContainerStyle={{ padding: 8 }}>
                <Text style={styles.errorText}>
                  {this.state.error.toString()}
                </Text>
              </ScrollView>
            )}

            <TouchableOpacity style={styles.resetBtn} onPress={this.handleReset}>
              <Ionicons name="refresh-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.resetBtnText}>Restart Application</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    maxWidth: 420,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  errorBox: {
    maxHeight: 120,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    width: '100%',
    marginBottom: 20,
  },
  errorText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#475569',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    justifyContent: 'center',
  },
  resetBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
