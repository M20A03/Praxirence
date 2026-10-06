import { Platform, TextStyle } from 'react-native';

/**
 * Praxirence System-Adaptive Typography Engine
 * Inherits the user's active device font (custom fonts, design fonts, or system font
 * selected in Android / iOS Settings) so both apps seamlessly honor their personal phone typography.
 * Font weights are strictly preserved via standard numeric weight mapping.
 */

export const FontFamily = {
  // Using undefined allows React Native on Android and iOS to render with the
  // user's active system/custom font configured in their device's Settings.
  regular: undefined,
  medium: undefined,
  semiBold: undefined,
  bold: undefined,
  extraBold: undefined,
  sans: undefined,
  display: undefined,
  mono: Platform.select({
    android: 'monospace',
    ios: 'Menlo',
    default: 'monospace',
  }),
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
  extraBold: '800' as const,
};

export const FontSize = {
  caption: 11,
  xs: 12,
  sm: 13,
  base: 14,
  body: 15,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 22,
  display: 26,
  hero: 30,
};

export const LetterSpacing = {
  tighter: -0.5,
  tight: -0.2,
  normal: 0,
  wide: 0.15,
  wider: 0.3,
  widest: 0.5,
};

export const Typography = {
  hero: {
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.extraBold,
    fontSize: FontSize.hero,
    lineHeight: 36,
    letterSpacing: LetterSpacing.tighter,
  } as TextStyle,

  display: {
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.display,
    lineHeight: 32,
    letterSpacing: LetterSpacing.tight,
  } as TextStyle,

  h1: {
    fontFamily: FontFamily.bold,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.xxl,
    lineHeight: 28,
    letterSpacing: LetterSpacing.tight,
  } as TextStyle,

  h2: {
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
    fontSize: FontSize.xl,
    lineHeight: 26,
    letterSpacing: LetterSpacing.tight,
  } as TextStyle,

  h3: {
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
    fontSize: FontSize.lg,
    lineHeight: 24,
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,

  h4: {
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
    fontSize: FontSize.md,
    lineHeight: 22,
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,

  body: {
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    fontSize: FontSize.body,
    lineHeight: 22,
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,

  bodyMedium: {
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    fontSize: FontSize.body,
    lineHeight: 22,
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,

  bodyBold: {
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.body,
    lineHeight: 22,
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,

  subtext: {
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    fontSize: FontSize.sm,
    lineHeight: 18,
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,

  subtextMedium: {
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    fontSize: FontSize.sm,
    lineHeight: 18,
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,

  caption: {
    fontFamily: FontFamily.regular,
    fontWeight: FontWeight.regular,
    fontSize: FontSize.xs,
    lineHeight: 16,
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,

  captionMedium: {
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    fontSize: FontSize.xs,
    lineHeight: 16,
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,

  badge: {
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
    fontSize: FontSize.xs,
    lineHeight: 16,
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,

  button: {
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
    fontSize: FontSize.body,
    lineHeight: 20,
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,

  buttonSmall: {
    fontFamily: FontFamily.medium,
    fontWeight: FontWeight.medium,
    fontSize: FontSize.sm,
    lineHeight: 18,
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,

  metric: {
    fontFamily: FontFamily.semiBold,
    fontWeight: FontWeight.semiBold,
    fontSize: FontSize.xl,
    lineHeight: 26,
    letterSpacing: LetterSpacing.tight,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
};
