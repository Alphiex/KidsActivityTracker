import { Image } from 'react-native';
import { activityImageMap } from '../assets/images';

/**
 * Preload all activity images to ensure they're cached and ready to display
 * This helps with performance, especially on slower connections
 */
export const preloadActivityImages = async (): Promise<void> => {
  const imagePromises: Promise<any>[] = [];
  
  // Convert the image map to an array of values and preload each one
  Object.values(activityImageMap).forEach((imageSource) => {
    if (typeof imageSource === 'number') {
      // It's a required image (bundled asset)
      imagePromises.push(
        Image.prefetch(Image.resolveAssetSource(imageSource).uri)
          .catch((error) => {
            console.warn('Failed to preload image:', error);
            // Don't let individual failures stop the whole process
            return Promise.resolve();
          })
      );
    }
  });
  
  try {
    await Promise.all(imagePromises);
    console.log(`Successfully preloaded ${imagePromises.length} activity images`);
  } catch (error) {
    console.warn('Error preloading images:', error);
  }
};

/**
 * Get the most commonly used images based on activity categories
 * These should be preloaded with higher priority
 */
export const getHighPriorityImages = () => {
  return [
    'swimming',
    'sports_general',
    'arts_crafts',
    'summer_camp',
    'early_years',
    'recreation_center',
    'dance',
    'music',
    'fitness',
  ];
};

/**
 * Preload only high-priority images for faster initial load
 */
export const preloadHighPriorityImages = async (): Promise<void> => {
  const highPriorityKeys = getHighPriorityImages();
  const imagePromises: Promise<any>[] = [];
  
  highPriorityKeys.forEach((key) => {
    const imageSource = activityImageMap[key];
    if (imageSource && typeof imageSource === 'number') {
      imagePromises.push(
        Image.prefetch(Image.resolveAssetSource(imageSource).uri)
          .catch(() => Promise.resolve())
      );
    }
  });
  
  try {
    await Promise.all(imagePromises);
    console.log(`Successfully preloaded ${imagePromises.length} high-priority images`);
  } catch (error) {
    console.warn('Error preloading high-priority images:', error);
  }
};