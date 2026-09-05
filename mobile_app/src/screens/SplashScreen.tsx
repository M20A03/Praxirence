import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Image,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../theme';

interface SplashScreenProps {
  onFinish: () => void;
}

const { width } = Dimensions.get('window');

const LOADING_STEPS = [
  'Initializing Praxirence Clinical Vault...',
  'Connecting to Praxirence Cloud API...',
  'Synchronizing secure health records...',
  'Verifying HIPAA & DPDP Act compliance...',
  'System Ready.',
];

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [stepIndex, setStepIndex] = useState(0);

  // Animations
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Entrance animation for logo & text
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 800,
        delay: 250,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Smooth progress bar animation over 2.2 seconds
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 2200,
      useNativeDriver: false,
    }).start(() => {
      // Small pause at 100% before transition
      setTimeout(() => {
        onFinish();
      }, 250);
    });

    // 3. Step ticker intervals
    const interval = setInterval(() => {
      setStepIndex((prev) => {
        if (prev < LOADING_STEPS.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 450);

    return () => clearInterval(interval);
  }, [logoOpacity, logoScale, contentFade, progressAnim, onFinish]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['5%', '100%'],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Decorative ambient aura */}
      <View style={styles.auraTopLeft} />
      <View style={styles.auraBottomRight} />

      <View style={styles.centerContainer}>
        {/* Animated Brand Logo Emblem */}
        <Animated.View
          style={[
            styles.logoWrapper,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <View style={styles.logoCard}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        {/* Brand Typography */}
        <Animated.View style={[styles.brandTextWrapper, { opacity: contentFade }]}>
          <View style={styles.brandTitleRow}>
            <Text style={styles.brandText}>prax</Text>
            <Text style={styles.brandTextCyan}>i</Text>
            <Text style={styles.brandTextEmerald}>rence</Text>
          </View>

          <Text style={styles.brandSubtitle}>
            Precision Medical & Healthcare Platform
          </Text>
        </Animated.View>

        {/* Loading Progress Bar & Status Ticker */}
        <Animated.View style={[styles.loadingSection, { opacity: contentFade }]}>
          <View style={styles.progressBarTrack}>
            <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
          </View>

          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{LOADING_STEPS[stepIndex]}</Text>
          </View>
        </Animated.View>
      </View>

      {/* DPDP Compliance & Secure Footer */}
      <Animated.View style={[styles.footer, { opacity: contentFade }]}>
        <Text style={styles.footerText}>
          🔒 Praxirence Clinical Vault • DPDP Act 2023
        </Text>
        <Text style={styles.versionText}>v1.0.0 Production</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  auraTopLeft: {
    position: 'absolute',
    top: -60,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(13, 148, 136, 0.08)',
  },
  auraBottomRight: {
    position: 'absolute',
    bottom: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
  },
  logoWrapper: {
    marginBottom: 20,
  },
  logoCard: {
    width: 104,
    height: 104,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(13, 148, 136, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 6,
  },
  logoImage: {
    width: 86,
    height: 86,
    borderRadius: 20,
  },
  brandTextWrapper: {
    alignItems: 'center',
    marginBottom: 36,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  brandText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 32,
    color: Colors.text,
    letterSpacing: LetterSpacing.tighter,
  },
  brandTextCyan: {
    fontFamily: FontFamily.extraBold,
    fontSize: 32,
    color: Colors.cyan,
  },
  brandTextEmerald: {
    fontFamily: FontFamily.extraBold,
    fontSize: 32,
    color: Colors.primary,
    letterSpacing: LetterSpacing.tighter,
  },
  brandSubtitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  loadingSection: {
    width: '100%',
    alignItems: 'center',
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.borderSubtle,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  statusText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  versionText: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: LetterSpacing.wider,
    textTransform: 'uppercase',
  },
});
