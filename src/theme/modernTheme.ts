export const ModernColors = {
  // Primary palette - pink pastel (modern & playful)
  primary: '#E8638B',
  primaryLight: '#FFB5C5',
  primaryDark: '#D53F8C',
  primaryGradient: ['#FFB5C5', '#E8638B', '#D53F8C'],

  // Secondary palette - soft blue (complementary)
  secondary: '#7C9EF5',
  secondaryLight: '#A5BFFA',
  secondaryDark: '#5B7FE5',
  secondaryGradient: ['#A5BFFA', '#7C9EF5', '#5B7FE5'],

  // Accent palette - warm coral (matches pink theme)
  accent: '#FFD166',
  accentLight: '#FFE5A0',
  accentDark: '#F5B800',
  accentGradient: ['#FFE5A0', '#FFD166', '#F5B800'],
  
  // Success palette - green (matches v0)
  success: '#10B981',
  successLight: '#34D399',
  successDark: '#059669',
  successGradient: ['#10B981', '#059669'],
  
  // Warning palette - amber
  warning: '#F59E0B',
  warningLight: '#FBBF24',
  warningDark: '#D97706',
  
  // Error palette - red
  error: '#EF4444',
  errorLight: '#F87171',
  errorDark: '#DC2626',
  
  // Neutral palette - lighter background like v0
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceLight: '#FFFFFF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  
  // Text colors
  text: '#1E293B',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textOnPrimary: '#FFFFFF',
  
  // Special colors
  transparent: 'transparent',
  overlay: 'rgba(0, 0, 0, 0.3)',
  shadowColor: '#000000',
  
  // Category colors with gradients - matching v0 design panels
  categoryGradients: {
    location: ['rgba(59, 130, 246, 0.1)', 'rgba(59, 130, 246, 0.05)'],  // blue/10 to blue/5
    favorites: ['rgba(20, 184, 166, 0.1)', 'rgba(20, 184, 166, 0.05)'],  // teal/10 to teal/5
    budget: ['rgba(251, 191, 36, 0.1)', 'rgba(251, 191, 36, 0.05)'],     // yellow/10 to yellow/5  
    new: ['rgba(16, 185, 129, 0.1)', 'rgba(16, 185, 129, 0.05)'],        // green/10 to green/5
    sports: ['rgba(147, 197, 253, 0.15)', 'rgba(147, 197, 253, 0.08)'],      // Light blue
    arts: ['rgba(249, 168, 212, 0.15)', 'rgba(249, 168, 212, 0.08)'],        // Light pink
    music: ['rgba(254, 215, 170, 0.15)', 'rgba(254, 215, 170, 0.08)'],       // Light orange
    science: ['rgba(167, 243, 208, 0.15)', 'rgba(167, 243, 208, 0.08)'],     // Light green
    dance: ['rgba(252, 231, 243, 0.15)', 'rgba(252, 231, 243, 0.08)'],       // Pink
    outdoor: ['rgba(209, 250, 229, 0.15)', 'rgba(209, 250, 229, 0.08)'],     // Green
  },
  
  // Activity type background colors
  activityTypeBackgrounds: {
    'Sports': '#EBF5FF',       // Light blue
    'Arts & Crafts': '#FCE7F3', // Light pink  
    'Music': '#FEF3C7',        // Light yellow
    'Science': '#D1FAE5',      // Light green
    'Dance': '#FCE7F3',        // Light pink
    'Outdoor': '#D1FAE5',      // Light green
  },
  
  // Card colors
  cardBackground: '#FFFFFF',
  cardBorder: '#E5E7EB',
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
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
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

// Activity type colors matching v0 design
export const ActivityTypeColors: { [key: string]: string } = {
  'Sports': 'bg-secondary',
  'Arts & Crafts': 'bg-primary',
  'Music': 'bg-accent',
  'Science': 'bg-success',
  'Dance': 'bg-chart-5',
  'Outdoor': 'bg-chart-4',
};

export const AgeGroupEmojis: { [key: string]: string } = {
  'Early Years': '👶',
  'School Age': '🎒',
  'Youth': '🧑‍🎓',
  'All Ages': '👨‍👩‍👧‍👦',
  'Teens': '🤳',
};