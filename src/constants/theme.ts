/**
 * Theme constants for Bible Accountability App
 * Migrated from reference project with mobile-optimized values
 */

export const Colors = {
  // Primary colors (from reference project)
  sacredGold: '#C4941D',
  deepEarth: '#5A4A3B',
  spiritualBlue: '#4A5F7F',

  // Background colors
  parchment: '#F5F1E8',
  lightParchment: '#FAF8F3',
  white: '#FFFFFF',

  // Neutral colors
  stoneGray: '#8B7E6A',
  lightGray: '#D4CFC5',
  darkGray: '#3A3A3A',

  // Status colors
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  info: '#2196F3',

  // Group/Social colors
  groupBlue: '#5B7FBF',
  groupGreen: '#6FAF8D',

  // Text colors
  textPrimary: '#2A2A2A',
  textSecondary: '#5A5A5A',
  textTertiary: '#8B8B8B',
  textLight: '#FFFFFF',

  // Border colors
  border: '#E0DDD5',
  borderLight: '#F0EDE5',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  round: 999,
};

export const FontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 40,
};

export const FontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
};

export const Layout = {
  screenPadding: Spacing.lg,
  cardPadding: Spacing.md,
  maxWidth: 600, // Max width for content on tablets
};

/**
 * Typography styles for common text elements
 */
export const Typography = {
  h1: {
    fontSize: FontSizes.display,
    fontWeight: FontWeights.bold,
    color: Colors.deepEarth,
    lineHeight: FontSizes.display * 1.2,
  },
  h2: {
    fontSize: FontSizes.xxxl,
    fontWeight: FontWeights.bold,
    color: Colors.deepEarth,
    lineHeight: FontSizes.xxxl * 1.25,
  },
  h3: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.semibold,
    color: Colors.deepEarth,
    lineHeight: FontSizes.xxl * 1.3,
  },
  h4: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.semibold,
    color: Colors.deepEarth,
    lineHeight: FontSizes.xl * 1.3,
  },
  body: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.regular,
    color: Colors.textPrimary,
    lineHeight: FontSizes.md * 1.5,
  },
  bodyLarge: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.regular,
    color: Colors.textPrimary,
    lineHeight: FontSizes.lg * 1.5,
  },
  caption: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.regular,
    color: Colors.textSecondary,
    lineHeight: FontSizes.sm * 1.4,
  },
  button: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.white,
    lineHeight: FontSizes.md * 1.2,
  },
  link: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.medium,
    color: Colors.spiritualBlue,
    lineHeight: FontSizes.md * 1.5,
    textDecorationLine: 'underline' as const,
  },
};

/**
 * Common component styles
 */
export const CommonStyles = {
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.md,
  },
  button: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.parchment,
    padding: Spacing.lg,
  },
};
