import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../theme';

interface BrandLogoMobileProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

export const BrandLogoMobile: React.FC<BrandLogoMobileProps> = ({
  size = 'md',
  showSubtitle = true,
}) => {
  const isLg = size === 'lg';
  const isSm = size === 'sm';

  const boxSize = isLg ? 64 : isSm ? 36 : 48;
  const fontSize = isLg ? 26 : isSm ? 18 : 22;
  const iconCross = isLg ? 16 : isSm ? 10 : 12;

  return (
    <View style={styles.container}>
      {/* Native Precision Medical & Life Emblem */}
      <View
        style={[
          styles.emblemBox,
          {
            width: boxSize,
            height: boxSize,
            borderRadius: boxSize * 0.32,
          },
        ]}
      >
        {/* Leaf Aura Accent (Top-Left) */}
        <View style={styles.leafAccent}>
          <Text style={{ fontSize: isLg ? 16 : 12, lineHeight: isLg ? 18 : 14 }}>🍃</Text>
        </View>

        {/* Central Clinical Cross Shield */}
        <View style={styles.crossContainer}>
          {/* Vertical Bar */}
          <View
            style={[
              styles.crossBarVertical,
              { height: iconCross, width: iconCross * 0.35, borderRadius: 2 },
            ]}
          />
          {/* Horizontal Bar */}
          <View
            style={[
              styles.crossBarHorizontal,
              { width: iconCross, height: iconCross * 0.35, borderRadius: 2 },
            ]}
          />
        </View>

        {/* Vitality Dot Accent */}
        <View style={styles.vitalityDot} />
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
            Patient Care & Health Plan
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
  emblemBox: {
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: 'rgba(13, 148, 136, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  leafAccent: {
    position: 'absolute',
    top: -4,
    left: -4,
  },
  crossContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  crossBarVertical: {
    backgroundColor: '#ffffff',
    position: 'absolute',
  },
  crossBarHorizontal: {
    backgroundColor: '#ffffff',
    position: 'absolute',
  },
  vitalityDot: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primaryLight,
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
