import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../theme';

interface BrandLogoMobileProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
}

export const BrandLogoMobile: React.FC<BrandLogoMobileProps> = ({
  size = 'md',
  showSubtitle = true,
}) => {
  const isXl = size === 'xl';
  const isLg = size === 'lg';
  const isSm = size === 'sm';

  const boxSize = isXl ? 88 : isLg ? 68 : isSm ? 38 : 52;
  const fontSize = isXl ? 30 : isLg ? 26 : isSm ? 18 : 22;

  return (
    <View style={styles.container}>
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
            Clinical Intelligence & Health Platform
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
