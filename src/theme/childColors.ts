/**
 * Child Colors & Avatars
 *
 * Defines the color palette and avatar options for child profiles.
 * Each child is assigned a unique color and avatar that is displayed
 * throughout the app for easy identification.
 */

export interface ChildColor {
  id: number;
  name: string;
  hex: string;
}

export interface ChildAvatarDef {
  id: number;
  name: string;
  emoji: string;         // Fallback emoji for the avatar
  source: any | null;    // ImageSourcePropType from react-native, null if using emoji
}

/**
 * Pastel color palette for children
 * These soft colors are used as border rings around avatars
 */
export const CHILD_COLORS: ChildColor[] = [
  { id: 1, name: 'Coral', hex: '#FF8A8A' },      // Stronger coral
  { id: 2, name: 'Peach', hex: '#FFB87A' },      // Stronger peach/orange
  { id: 3, name: 'Gold', hex: '#E6A832' },       // Gold instead of yellow (readable)
  { id: 4, name: 'Mint', hex: '#5CC9A7' },       // Stronger mint
  { id: 5, name: 'Sky', hex: '#5BB5E0' },        // Stronger sky blue
  { id: 6, name: 'Lavender', hex: '#A87CC9' },   // Stronger lavender
  { id: 7, name: 'Rose', hex: '#E87AAD' },       // Stronger rose
  { id: 8, name: 'Teal', hex: '#4DB6B6' },       // Stronger teal
  { id: 9, name: 'Sage', hex: '#7CB87C' },       // Stronger sage
  { id: 10, name: 'Periwinkle', hex: '#7A9ED9' }, // Stronger periwinkle
];

/**
 * Cute animal avatars for children
 * These friendly animal characters help personalize each child's profile
 *
 * Note: Uses emoji fallbacks. Replace with actual PNG images when available:
 * - Download from Flaticon: https://www.flaticon.com/free-icons/cute-animals-avatar
 * - Or Freepik: https://www.freepik.com/free-photos-vectors/animal-avatar
 */
export const CHILD_AVATARS: ChildAvatarDef[] = [
  { id: 1, name: 'Cat', emoji: '🐱', source: null },
  { id: 2, name: 'Dog', emoji: '🐶', source: null },
  { id: 3, name: 'Bunny', emoji: '🐰', source: null },
  { id: 4, name: 'Bear', emoji: '🐻', source: null },
  { id: 5, name: 'Fox', emoji: '🦊', source: null },
  { id: 6, name: 'Owl', emoji: '🦉', source: null },
  { id: 7, name: 'Penguin', emoji: '🐧', source: null },
  { id: 8, name: 'Panda', emoji: '🐼', source: null },
  { id: 9, name: 'Lion', emoji: '🦁', source: null },
  { id: 10, name: 'Koala', emoji: '🐨', source: null },
];

/**
 * Get a child color by ID
 * Falls back to first color if ID not found
 */
export const getChildColor = (colorId?: number): ChildColor => {
  if (!colorId) return CHILD_COLORS[0];
  return CHILD_COLORS.find(c => c.id === colorId) || CHILD_COLORS[0];
};

/**
 * Get a child avatar by ID
 * Falls back to first avatar if ID not found
 */
export const getChildAvatar = (avatarId?: number): ChildAvatarDef => {
  if (!avatarId) return CHILD_AVATARS[0];
  return CHILD_AVATARS.find(a => a.id === avatarId) || CHILD_AVATARS[0];
};

/**
 * Get the next available avatar ID that isn't used by siblings
 * @param usedAvatarIds - Array of avatar IDs already in use
 * @returns The next available avatar ID (cycles if all are used)
 */
export const getNextAvailableAvatarId = (usedAvatarIds: number[]): number => {
  for (const avatar of CHILD_AVATARS) {
    if (!usedAvatarIds.includes(avatar.id)) {
      return avatar.id;
    }
  }
  // All avatars used, cycle back to first
  return 1;
};

/**
 * Get the next available color ID that isn't used by siblings
 * @param usedColorIds - Array of color IDs already in use
 * @returns The next available color ID (cycles if all are used)
 */
export const getNextAvailableColorId = (usedColorIds: number[]): number => {
  for (const color of CHILD_COLORS) {
    if (!usedColorIds.includes(color.id)) {
      return color.id;
    }
  }
  // All colors used, cycle back to first
  return 1;
};

/**
 * Get gradient colors for multiple children
 * Used when an activity is assigned to multiple children
 * @param colorIds - Array of child color IDs
 * @returns Array of hex colors for gradient (always 2 colors)
 */
export const getGradientColorsForChildren = (colorIds: number[]): string[] => {
  if (colorIds.length === 0) {
    return ['#FFFFFF', '#FFFFFF'];
  }
  if (colorIds.length === 1) {
    const color = getChildColor(colorIds[0]).hex;
    return [color, color];
  }
  // Return first two children's colors for gradient
  return colorIds.slice(0, 2).map(id => getChildColor(id).hex);
};

/**
 * Default export for convenient imports
 */
export default {
  CHILD_COLORS,
  CHILD_AVATARS,
  getChildColor,
  getChildAvatar,
  getNextAvailableAvatarId,
  getNextAvailableColorId,
  getGradientColorsForChildren,
};
