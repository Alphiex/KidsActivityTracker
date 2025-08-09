import { Router, Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';

const router = Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/v1/categories
 * @desc    Get all activity categories
 * @access  Public
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    // Get unique categories from activities
    const categories = await prisma.activity.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ['category']
    });

    const uniqueCategories = categories
      .map(c => c.category)
      .filter(Boolean)
      .sort();

    res.json({
      success: true,
      categories: uniqueCategories
    });
  } catch (error: any) {
    console.error('Categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

/**
 * @route   GET /api/v1/locations
 * @desc    Get all locations
 * @access  Public
 */
router.get('/locations', async (req: Request, res: Response) => {
  try {
    const locations = await prisma.location.findMany({
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      locations
    });
  } catch (error: any) {
    console.error('Locations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch locations'
    });
  }
});

/**
 * @route   GET /api/v1/providers
 * @desc    Get all active providers
 * @access  Public
 */
router.get('/providers', async (req: Request, res: Response) => {
  try {
    const providers = await prisma.provider.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        website: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      providers
    });
  } catch (error: any) {
    console.error('Providers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch providers'
    });
  }
});

export default router;