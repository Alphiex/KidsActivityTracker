const prisma = require('../config/database');

class UserService {
  /**
   * Create or update user
   */
  async upsertUser(email, data = {}) {
    return prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: data.name,
        preferences: data.preferences || {}
      },
      update: {
        name: data.name,
        preferences: data.preferences
      }
    });
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        favorites: {
          include: {
            activity: {
              include: {
                provider: true,
                location: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  /**
   * Add activity to favorites
   */
  async addFavorite(userId, activityId, notes = null) {
    // Check if activity exists and is active
    const activity = await prisma.activity.findUnique({
      where: { id: activityId }
    });

    if (!activity || !activity.isActive) {
      throw new Error('Activity not found or inactive');
    }

    return prisma.favorite.create({
      data: {
        userId,
        activityId,
        notes
      },
      include: {
        activity: {
          include: {
            provider: true,
            location: true
          }
        }
      }
    });
  }

  /**
   * Remove from favorites
   */
  async removeFavorite(userId, activityId) {
    return prisma.favorite.delete({
      where: {
        userId_activityId: {
          userId,
          activityId
        }
      }
    });
  }

  /**
   * Update favorite notes
   */
  async updateFavoriteNotes(userId, activityId, notes) {
    return prisma.favorite.update({
      where: {
        userId_activityId: {
          userId,
          activityId
        }
      },
      data: { notes }
    });
  }

  /**
   * Get user's favorite activities
   */
  async getUserFavorites(userId, includeInactive = false) {
    const where = { userId };
    
    if (!includeInactive) {
      where.activity = { isActive: true };
    }

    return prisma.favorite.findMany({
      where,
      include: {
        activity: {
          include: {
            provider: true,
            location: true,
            _count: {
              select: { favorites: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get recommended activities based on favorites
   */
  async getRecommendedActivities(userId, limit = 10) {
    // Get user's favorite categories
    const favorites = await prisma.favorite.findMany({
      where: { userId },
      include: {
        activity: {
          select: {
            category: true,
            ageMin: true,
            ageMax: true,
            cost: true
          }
        }
      }
    });

    if (favorites.length === 0) {
      // Return popular activities if no favorites
      return prisma.activity.findMany({
        where: { isActive: true },
        include: {
          provider: true,
          location: true,
          _count: {
            select: { favorites: true }
          }
        },
        orderBy: {
          favorites: { _count: 'desc' }
        },
        take: limit
      });
    }

    // Calculate preferences
    const categories = favorites.map(f => f.activity.category);
    const avgMinAge = Math.floor(
      favorites.reduce((sum, f) => sum + f.activity.ageMin, 0) / favorites.length
    );
    const avgMaxAge = Math.ceil(
      favorites.reduce((sum, f) => sum + f.activity.ageMax, 0) / favorites.length
    );
    const maxCost = Math.max(...favorites.map(f => f.activity.cost)) * 1.5;

    // Get similar activities
    const favoriteIds = favorites.map(f => f.activityId);
    
    return prisma.activity.findMany({
      where: {
        isActive: true,
        id: { notIn: favoriteIds },
        category: { in: [...new Set(categories)] },
        ageMin: { lte: avgMaxAge },
        ageMax: { gte: avgMinAge },
        cost: { lte: maxCost }
      },
      include: {
        provider: true,
        location: true,
        _count: {
          select: { favorites: true }
        }
      },
      orderBy: [
        { favorites: { _count: 'desc' } },
        { dateStart: 'asc' }
      ],
      take: limit
    });
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId, preferences) {
    return prisma.user.update({
      where: { id: userId },
      data: { preferences }
    });
  }
}

module.exports = new UserService();