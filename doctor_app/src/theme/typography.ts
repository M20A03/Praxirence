import { Platform, TextStyle } from 'react-native';

/**
 * Praxirence Clinical Typography System
 * High-legibility, institutional-grade clinical typography powered by Inter
 * Synchronized with Web & Mobile clinical design standards (Apple Health / Epic / Linear)
 */

export const FontFamily = {
  regular: Platform.select({
    android: 'Inter-Regular',
    ios: 'Inter-Regular',
    default: 'sans-serif',
  }),
  medium: Platform.select({
    android: 'Inter-Medium',
    ios: 'Inter-Medium',
    default: 'sans-serif-medium',
  }),
  semiBold: Platform.select({
    android: 'Inter-SemiBold',
    ios: 'Inter-SemiBold',
    default: 'sans-serif-medium',
  }),
  bold: Platform.select({
    android: 'Inter-Bold',
    ios: 'Inter-Bold',
    default: 'sans-serif',
  }),
  extraBold: Platform.select({
    android: 'Inter-Bold',
    ios: 'Inter-Bold',
    default: 'sans-serif',
  }),
  sans: Platform.select({
    android: 'Inter-Regular',
    ios: 'Inter-Regular',
    default: 'sans-serif',
  }),
  display: Platform.select({
    android: 'Inter-Bold',
    ios: 'Inter-Bold',
    default: 'sans-serif',
  }),
  mono: Platform.select({
    android: 'monospace',
    ios: 'Menlo',
    default: 'monospace',
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
    fontSize: FontSize.hero,
    lineHeight: 36,
    letterSpacing: LetterSpacing.tighter,
  } as TextStyle,

  display: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.display,
    lineHeight: 32,
    letterSpacing: LetterSpacing.tight,
  } as TextStyle,

  h1: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xxl,
    lineHeight: 28,
    letterSpacing: LetterSpacing.tight,
  } as TextStyle,

  h2: {
    fontFamily: FontFamily.semiBold,
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
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,

  caption: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    lineHeight: 16,
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,

  captionMedium: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    lineHeight: 16,
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,

  badge: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    lineHeight: 16,
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,

  button: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    lineHeight: 20,
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,

  buttonSmall: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    lineHeight: 18,
    letterSpacing: LetterSpacing.normal,
  } as TextStyle,

  metric: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xl,
    lineHeight: 26,
    letterSpacing: LetterSpacing.tight,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
};
