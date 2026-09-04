import { Platform, TextStyle } from 'react-native';

/**
 * Praxirence Clinical Typography System
 * Powered by Plus Jakarta Sans (Institutional Medical Grade)
 * Synchronized with Web Application Design Tokens
 */

export const FontFamily = {
  regular: Platform.select({
    android: 'PlusJakartaSans-Regular',
    ios: 'PlusJakartaSans-Regular',
    default: 'sans-serif',
  }),
  medium: Platform.select({
    android: 'PlusJakartaSans-Medium',
    ios: 'PlusJakartaSans-Medium',
    default: 'sans-serif-medium',
  }),
  semiBold: Platform.select({
    android: 'PlusJakartaSans-SemiBold',
    ios: 'PlusJakartaSans-SemiBold',
    default: 'sans-serif',
  }),
  bold: Platform.select({
    android: 'PlusJakartaSans-Bold',
    ios: 'PlusJakartaSans-Bold',
    default: 'sans-serif',
  }),
  extraBold: Platform.select({
    android: 'PlusJakartaSans-ExtraBold',
    ios: 'PlusJakartaSans-ExtraBold',
    default: 'sans-serif',
  }),
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
  xxl: 24,
  display: 28,
  hero: 32,
};

export const LetterSpacing = {
  tighter: -0.6,
  tight: -0.3,
  normal: 0,
  wide: 0.2,
  wider: 0.5,
  widest: 1.0,
};

export const Typography = {
  hero: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.hero,
    lineHeight: 38,
    letterSpacing: LetterSpacing.tighter,
  } as TextStyle,

  display: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.display,
    lineHeight: 34,
    letterSpacing: LetterSpacing.tight,
  } as TextStyle,

  h1: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xxl,
    lineHeight: 30,
    letterSpacing: LetterSpacing.tight,
  } as TextStyle,

  h2: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    lineHeight: 26,
    letterSpacing: LetterSpacing.tight,
  } as TextStyle,

  h3: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.lg,
    lineHeight: 24,
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,

  h4: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.md,
    lineHeight: 22,
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,

  body: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    lineHeight: 22,
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,

  bodyMedium: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.body,
    lineHeight: 22,
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,

  bodyBold: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    lineHeight: 22,
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,

  subtext: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: 18,
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,

  subtextMedium: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    lineHeight: 18,
    letterSpacing: LetterSpacing.wide,
  } as TextStyle,

  caption: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    lineHeight: 16,
    letterSpacing: LetterSpacing.wide,
  } as TextStyle,

  badge: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    lineHeight: 14,
    letterSpacing: LetterSpacing.wider,
    textTransform: 'uppercase' as const,
  } as TextStyle,

  button: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    lineHeight: 20,
    letterSpacing: LetterSpacing.wide,
  } as TextStyle,

  buttonSmall: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    lineHeight: 18,
    letterSpacing: LetterSpacing.wide,
  } as TextStyle,
};
