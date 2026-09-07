import React from 'react';
import { View, Text, StyleSheet, Image, ViewStyle } from 'react-native';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../theme';

interface BrandLogoMobileProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'hero' | 'header' | 'widget';
  showSubtitle?: boolean;
  subtitleText?: string;
  style?: ViewStyle;
}

export const BrandLogoMobile: React.FC<BrandLogoMobileProps> = ({
  size = 'md',
  variant = 'hero',
  showSubtitle = true,
  subtitleText = 'Clinical Intelligence Platform',
  style,
}) => {
  const isXl = size === 'xl';
  const isLg = size === 'lg';
  const isSm = size === 'sm';

  // Compact Header Variant for Top App Bars
  if (variant === 'header') {
    const iconSize = isSm ? 28 : isLg ? 40 : 34;
    const titleSize = isSm ? 18 : isLg ? 24 : 20;

    return (
      <View style={[styles.headerRow, style]}>
        <View
          style={[
            styles.headerLogoBox,
            {
              width: iconSize + 6,
              height: iconSize + 6,
              borderRadius: (iconSize + 6) * 0.28,
            },
          ]}
        >
          <Image
            source={require('../../assets/logo.png')}
            style={{
              width: iconSize,
              height: iconSize,
              borderRadius: iconSize * 0.22,
            }}
            resizeMode="contain"
          />
        </View>

        <View style={styles.headerTextCol}>
          <View style={styles.brandTitleRow}>
            <Text style={[styles.brandText, { fontSize: titleSize }]}>prax</Text>
            <Text style={[styles.brandTextCyan, { fontSize: titleSize }]}>i</Text>
            <Text style={[styles.brandTextEmerald, { fontSize: titleSize }]}>rence</Text>
          </View>
          {showSubtitle && (
            <Text style={[styles.headerSubtitle, { fontSize: isSm ? 9 : 10 }]}>
              {subtitleText}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Compact Widget Emblem Variant for Cards & Badges
  if (variant === 'widget') {
    const iconSize = isSm ? 24 : isLg ? 36 : 28;
    return (
      <View
        style={[
          styles.widgetLogoBox,
          {
            width: iconSize + 8,
            height: iconSize + 8,
            borderRadius: (iconSize + 8) * 0.28,
          },
          style,
        ]}
      >
        <Image
          source={require('../../assets/logo.png')}
          style={{
            width: iconSize,
            height: iconSize,
            borderRadius: iconSize * 0.2,
          }}
          resizeMode="contain"
        />
      </View>
    );
  }

  // Hero Variant (Default / Login / Splash)
  const boxSize = isXl ? 88 : isLg ? 68 : isSm ? 38 : 52;
  const fontSize = isXl ? 30 : isLg ? 26 : isSm ? 18 : 22;

  return (
    <View style={[styles.container, style]}>
      {/* Authentic High-Res Praxirence Logo */}
      <View
        style={[
          styles.logoCard,
          {
            width: boxSize + 12,
            height: boxSize + 12,
            borderRadius: (boxSize + 12) * 0.28,
          },
        ]}
      >
        <Image
          source={require('../../assets/logo.png')}
          style={{
            width: boxSize,
            height: boxSize,
            borderRadius: boxSize * 0.24,
          }}
          resizeMode="contain"
        />
      </View>

      {/* Brand Typography */}
      <View style={styles.textColumn}>
        <View style={styles.brandTitleRow}>
          <Text style={[styles.brandText, { fontSize }]}>prax</Text>
          <Text style={[styles.brandTextCyan, { fontSize }]}>i</Text>
          <Text style={[styles.brandTextEmerald, { fontSize }]}>rence</Text>
        </View>

        {showSubtitle && (
          <Text style={styles.brandSubtitle}>
            {subtitleText}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogoBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(13, 148, 136, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
    marginRight: 10,
  },
  headerTextCol: {
    justifyContent: 'center',
  },
  headerSubtitle: {
    fontFamily: FontFamily.semiBold,
    color: Colors.textSecondary,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  widgetLogoBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: 'rgba(13, 148, 136, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  logoCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(13, 148, 136, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 12,
  },
  textColumn: {
    alignItems: 'center',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  brandText: {
    fontFamily: FontFamily.extraBold,
    color: Colors.text,
    letterSpacing: LetterSpacing.tighter,
  },
  brandTextCyan: {
    fontFamily: FontFamily.extraBold,
    color: Colors.cyan,
  },
  brandTextEmerald: {
    fontFamily: FontFamily.extraBold,
    color: Colors.primary,
    letterSpacing: LetterSpacing.tighter,
  },
  brandSubtitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    letterSpacing: LetterSpacing.wider,
    marginTop: 4,
    textTransform: 'uppercase',
  },
});
