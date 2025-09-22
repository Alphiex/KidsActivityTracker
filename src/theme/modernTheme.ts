export const ModernColors = {
  // Primary palette - vibrant blue
  primary: '#3B82F6',
  primaryLight: '#60A5FA',
  primaryDark: '#2563EB',
  primaryGradient: ['#3B82F6', '#2563EB'],
  
  // Secondary palette - purple
  secondary: '#8B5CF6',
  secondaryLight: '#A78BFA',
  secondaryDark: '#7C3AED',
  secondaryGradient: ['#8B5CF6', '#7C3AED'],
  
  // Accent palette - teal
  accent: '#14B8A6',
  accentLight: '#2DD4BF',
  accentDark: '#0F766E',
  accentGradient: ['#14B8A6', '#0F766E'],
  
  // Success palette - green
  success: '#10B981',
  successLight: '#34D399',
  successDark: '#059669',
  successGradient: ['#10B981', '#059669'],
  
  // Warning palette - amber
  warning: '#F59E0B',
  warningLight: '#FBBa24',
  warningDark: '#D97706',
  
  // Error palette - red
  error: '#EF4444',
  errorLight: '#F87171',
  errorDark: '#DC2626',
  
  // Neutral palette
  background: '#FAFBFC',
  surface: '#FFFFFF',
  surfaceLight: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  
  // Text colors
  text: '#1E293B',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textOnPrimary: '#FFFFFF',
  
  // Special colors
  transparent: 'transparent',
  overlay: 'rgba(0, 0, 0, 0.3)',
  shadowColor: '#000000',
  
  // Category colors with gradients
  categoryGradients: {
    location: ['#3B82F6', '#60A5FA'],
    favorites: ['#EC4899', '#F472B6'],
    budget: ['#14B8A6', '#2DD4BF'],
    new: ['#10B981', '#34D399'],
    sports: ['#F59E0B', '#FBBF24'],
    arts: ['#8B5CF6', '#A78BFA'],
    music: ['#EC4899', '#F9A8D4'],
    science: ['#06B6D4', '#22D3EE'],
    dance: ['#F472B6', '#FBCFE8'],
    outdoor: ['#10B981', '#6EE7B7'],
  }
};

export const ModernSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const ModernTypography = {
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  weights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.8,
  }
};

export const ModernShadows = {
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
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
};

export const ModernBorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 999,
};

export const ActivityTypeEmojis: { [key: string]: string } = {
  'Sports': '⚽',
  'Arts & Crafts': '🎨',
  'Music': '🎵',
  'Science': '🔬',
  'Dance': '💃',
  'Outdoor': '🌳',
  'Swimming': '🏊',
  'Education': '📚',
  'Drama': '🎭',
  'Technology': '💻',
  'Cooking': '👨‍🍳',
  'Martial Arts': '🥋',
  'Yoga': '🧘',
  'Team Sports': '🏀',
  'Individual Sports': '🏃',
  'Fitness': '💪',
  'Nature': '🌿',
};

export const AgeGroupEmojis: { [key: string]: string } = {
  'Early Years': '👶',
  'School Age': '🎒',
  'Youth': '🧑‍🎓',
  'All Ages': '👨‍👩‍👧‍👦',
  'Teens': '🤳',
};