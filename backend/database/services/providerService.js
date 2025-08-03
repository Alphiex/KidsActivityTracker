const prisma = require('../config/database');

class ProviderService {
  /**
   * Get all providers
   */
  async getAllProviders(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };
    
    return prisma.provider.findMany({
      where,
      include: {
        _count: {
          select: {
            activities: { where: { isActive: true } },
            scrapeJobs: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * Get provider by ID
   */
  async getProviderById(id) {
    return prisma.provider.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            activities: { where: { isActive: true } },
            scrapeJobs: true
          }
        },
        scrapeJobs: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });
  }

  /**
   * Create provider
   */
  async createProvider(data) {
    return prisma.provider.create({
      data: {
        name: data.name,
        website: data.website,
        scraperConfig: data.scraperConfig || {},
        isActive: data.isActive !== false
      }
    });
  }

  /**
   * Update provider
   */
  async updateProvider(id, data) {
    return prisma.provider.update({
      where: { id },
      data: {
        name: data.name,
        website: data.website,
        scraperConfig: data.scraperConfig,
        isActive: data.isActive
      }
    });
  }

  /**
   * Get provider statistics
   */
  async getProviderStatistics(providerId) {
    const [
      activeActivities,
      totalActivities,
      categoryCounts,
      locationCounts,
      priceRange,
      lastScrape
    ] = await Promise.all([
      prisma.activity.count({
        where: { providerId, isActive: true }
      }),
      prisma.activity.count({
        where: { providerId }
      }),
      prisma.activity.groupBy({
        by: ['category'],
        where: { providerId, isActive: true },
        _count: { id: true }
      }),
      prisma.activity.groupBy({
        by: ['locationName'],
        where: { providerId, isActive: true },
        _count: { id: true }
      }),
      prisma.activity.aggregate({
        where: { providerId, isActive: true },
        _min: { cost: true },
        _max: { cost: true },
        _avg: { cost: true }
      }),
      prisma.scrapeJob.findFirst({
        where: { providerId, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' }
      })
    ]);

    return {
      activeActivities,
      totalActivities,
      categoryCounts: categoryCounts.map(c => ({
        category: c.category,
        count: c._count.id
      })),
      locationCounts: locationCounts.map(l => ({
        location: l.locationName,
        count: l._count.id
      })),
      priceRange: {
        min: priceRange._min.cost || 0,
        max: priceRange._max.cost || 0,
        avg: priceRange._avg.cost || 0
      },
      lastScrapeTime: lastScrape?.completedAt,
      lastScrapeActivities: lastScrape?.activitiesFound || 0
    };
  }

  /**
   * Get providers that need scraping
   */
  async getProvidersToScrape(intervalHours = 1) {
    const providers = await prisma.provider.findMany({
      where: { isActive: true },
      include: {
        scrapeJobs: {
          where: { status: 'COMPLETED' },
          orderBy: { completedAt: 'desc' },
          take: 1
        }
      }
    });

    return providers.filter(provider => {
      if (provider.scrapeJobs.length === 0) return true;
      
      const lastScrape = provider.scrapeJobs[0].completedAt;
      const hoursSinceLastScrape = 
        (Date.now() - lastScrape.getTime()) / (1000 * 60 * 60);
      
      return hoursSinceLastScrape >= intervalHours;
    });
  }
}

module.exports = new ProviderService();