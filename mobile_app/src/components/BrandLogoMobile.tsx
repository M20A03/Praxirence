import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

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
    backgroundColor: '#0c1626',
    borderWidth: 1.5,
    borderColor: 'rgba(6, 182, 212, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
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
    backgroundColor: '#10b981',
  },
  textColumn: {
    alignItems: 'center',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  brandText: {
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: -0.5,
  },
  brandTextCyan: {
    fontWeight: '900',
    color: '#06b6d4',
  },
  brandTextEmerald: {
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginTop: 4,
    textTransform: 'uppercase',
  },
});
