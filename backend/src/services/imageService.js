const { PrismaClient } = require('../../generated/prisma');
const prisma = new PrismaClient();

/**
 * Service for handling activity images with fallback hierarchy
 */
class ImageService {
  /**
   * Get the image URL for an activity with fallback logic
   * Hierarchy: Activity specific image → Subtype image → Type image → Default image
   */
  async getActivityImage(activity) {
    try {
      // 1. Check if activity has a specific image
      if (activity.imageUrl) {
        return {
          url: activity.imageUrl,
          source: 'activity'
        };
      }
      
      // 2. Check for subtype image
      if (activity.activitySubtype) {
        const subtype = await prisma.activitySubtype.findFirst({
          where: {
            name: activity.activitySubtype,
            activityType: {
              name: activity.activityType
            }
          },
          include: {
            activityType: true
          }
        });
        
        if (subtype?.imageUrl) {
          return {
            url: subtype.imageUrl,
            source: 'subtype'
          };
        }
        
        // 3. Check for type image (from subtype's parent)
        if (subtype?.activityType?.imageUrl) {
          return {
            url: subtype.activityType.imageUrl,
            source: 'type'
          };
        }
      }
      
      // 3b. If no subtype, check directly for type image
      if (activity.activityType) {
        const type = await prisma.activityType.findFirst({
          where: { name: activity.activityType }
        });
        
        if (type?.imageUrl) {
          return {
            url: type.imageUrl,
            source: 'type'
          };
        }
      }
      
      // 4. Return default image based on broad category
      return {
        url: this.getDefaultImage(activity),
        source: 'default'
      };
      
    } catch (error) {
      console.error('Error getting activity image:', error);
      return {
        url: this.getDefaultImage(activity),
        source: 'default'
      };
    }
  }
  
  /**
   * Get default image based on activity characteristics
   */
  getDefaultImage(activity) {
    // Map of keywords to default images
    const imageMap = {
      'swimming': '/images/defaults/swimming.jpg',
      'aquatics': '/images/defaults/swimming.jpg',
      'basketball': '/images/defaults/basketball.jpg',
      'soccer': '/images/defaults/soccer.jpg',
      'football': '/images/defaults/football.jpg',
      'hockey': '/images/defaults/hockey.jpg',
      'tennis': '/images/defaults/tennis.jpg',
      'dance': '/images/defaults/dance.jpg',
      'music': '/images/defaults/music.jpg',
      'art': '/images/defaults/art.jpg',
      'camp': '/images/defaults/camp.jpg',
      'martial': '/images/defaults/martial-arts.jpg',
      'skating': '/images/defaults/skating.jpg',
      'gym': '/images/defaults/fitness.jpg',
      'fitness': '/images/defaults/fitness.jpg',
      'yoga': '/images/defaults/yoga.jpg'
    };
    
    const searchText = `${activity.name || ''} ${activity.activityType || ''} ${activity.activitySubtype || ''}`.toLowerCase();
    
    // Check for keyword matches
    for (const [keyword, image] of Object.entries(imageMap)) {
      if (searchText.includes(keyword)) {
        return image;
      }
    }
    
    // Return generic default
    return '/images/defaults/activity.jpg';
  }
  
  /**
   * Set image URLs for activity type and subtypes
   */
  async setActivityTypeImages(typeCode, typeImageUrl, subtypeImages = {}) {
    try {
      // Update type image
      const type = await prisma.activityType.update({
        where: { code: typeCode },
        data: { imageUrl: typeImageUrl }
      });
      
      // Update subtype images
      for (const [subtypeCode, imageUrl] of Object.entries(subtypeImages)) {
        await prisma.activitySubtype.updateMany({
          where: {
            activityTypeId: type.id,
            code: subtypeCode
          },
          data: { imageUrl }
        });
      }
      
      return { success: true, type };
    } catch (error) {
      console.error('Error setting activity type images:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Bulk set default images for common activity types
   */
  async initializeDefaultImages() {
    const defaults = {
      'swimming-and-aquatics': {
        typeImage: '/images/types/swimming.jpg',
        subtypes: {
          'learn-to-swim': '/images/subtypes/learn-to-swim.jpg',
          'diving': '/images/subtypes/diving.jpg',
          'water-polo': '/images/subtypes/water-polo.jpg'
        }
      },
      'team-sports': {
        typeImage: '/images/types/team-sports.jpg',
        subtypes: {
          'basketball': '/images/subtypes/basketball.jpg',
          'soccer': '/images/subtypes/soccer.jpg',
          'hockey': '/images/subtypes/hockey.jpg',
          'baseball': '/images/subtypes/baseball.jpg',
          'volleyball': '/images/subtypes/volleyball.jpg'
        }
      },
      'martial-arts': {
        typeImage: '/images/types/martial-arts.jpg',
        subtypes: {
          'karate': '/images/subtypes/karate.jpg',
          'taekwondo': '/images/subtypes/taekwondo.jpg',
          'judo': '/images/subtypes/judo.jpg'
        }
      },
      'dance': {
        typeImage: '/images/types/dance.jpg',
        subtypes: {
          'ballet': '/images/subtypes/ballet.jpg',
          'hip-hop': '/images/subtypes/hip-hop.jpg',
          'jazz': '/images/subtypes/jazz.jpg'
        }
      },
      'music': {
        typeImage: '/images/types/music.jpg',
        subtypes: {
          'piano': '/images/subtypes/piano.jpg',
          'guitar': '/images/subtypes/guitar.jpg',
          'voice': '/images/subtypes/voice.jpg'
        }
      }
    };
    
    const results = [];
    for (const [typeCode, config] of Object.entries(defaults)) {
      const result = await this.setActivityTypeImages(
        typeCode,
        config.typeImage,
        config.subtypes
      );
      results.push({ typeCode, ...result });
    }
    
    return results;
  }
  
  /**
   * Get image for activity in API response
   * Enhances activity object with image information
   */
  async enhanceActivityWithImage(activity) {
    const imageData = await this.getActivityImage(activity);
    return {
      ...activity,
      image: imageData
    };
  }
  
  /**
   * Enhance multiple activities with images
   */
  async enhanceActivitiesWithImages(activities) {
    return Promise.all(activities.map(a => this.enhanceActivityWithImage(a)));
  }
}

module.exports = new ImageService();