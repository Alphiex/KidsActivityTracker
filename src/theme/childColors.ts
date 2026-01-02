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
  { id: 1, name: 'Coral', hex: '#FFB5B5' },
  { id: 2, name: 'Peach', hex: '#FFDAB3' },
  { id: 3, name: 'Lemon', hex: '#FFF5BA' },
  { id: 4, name: 'Mint', hex: '#B5EAD7' },
  { id: 5, name: 'Sky', hex: '#B5D8EB' },
  { id: 6, name: 'Lavender', hex: '#D4B5E0' },
  { id: 7, name: 'Rose', hex: '#F0B5D4' },
  { id: 8, name: 'Aqua', hex: '#B5E0E0' },
  { id: 9, name: 'Sage', hex: '#C5D9B5' },
  { id: 10, name: 'Periwinkle', hex: '#B5C5E0' },
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
 * Default export for convenient imports
 */
export default {
  CHILD_COLORS,
  CHILD_AVATARS,
  getChildColor,
  getChildAvatar,
  getNextAvailableAvatarId,
  getNextAvailableColorId,
};
