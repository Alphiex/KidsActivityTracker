import { Router, Request, Response } from 'express';
import { verifyToken, optionalAuth, logActivity } from '../middleware/auth';
import { sharingService } from '../services/sharingService';
import { childActivityService } from '../services/childActivityService';
import { query, param, body, validationResult } from 'express-validator';

const router = Router();

const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

/**
 * Get all shared children and their activities
 * GET /api/shared-activities/children
 */
router.get(
  '/children',
  verifyToken,
  query('sharingUserId').optional().isUUID(),
  handleValidationErrors,
  logActivity('view_shared_children'),
  async (req: Request, res: Response) => {
    try {
      const sharedChildren = await sharingService.getSharedChildren(
        req.user!.id,
        req.query.sharingUserId as string
      );

      // Format response with age calculation and activity summaries
      const formattedChildren = sharedChildren.map(child => {
        const age = Math.floor(
          (Date.now() - new Date(child.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
        );

        const activitySummary = {
          interested: child.activities.filter(a => a.status === 'interested').length,
          registered: child.activities.filter(a => a.status === 'registered').length,
          completed: child.activities.filter(a => a.status === 'completed').length
        };

        return {
          id: child.id,
          name: child.name,
          age,
          dateOfBirth: child.dateOfBirth,
          avatarUrl: child.avatarUrl,
          interests: child.interests,
          activitySummary,
          permissions: {
            canViewInterested: child.shareProfile.canViewInterested,
            canViewRegistered: child.shareProfile.canViewRegistered,
            canViewCompleted: child.shareProfile.canViewCompleted,
            canViewNotes: child.shareProfile.canViewNotes
          }
        };
      });

      res.json({
        success: true,
        children: formattedChildren
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch shared children'
      });
    }
  }
);

/**
 * Get activities for a specific shared child
 * GET /api/shared-activities/children/:childId/activities
 */
router.get(
  '/children/:childId/activities',
  verifyToken,
  param('childId').isUUID(),
  query('status').optional().isIn(['interested', 'registered', 'completed', 'cancelled']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  handleValidationErrors,
  logActivity('view_shared_child_activities'),
  async (req: Request, res: Response) => {
    try {
      // First check if user has access to this child
      const hasAccess = await sharingService.hasAccessToChild(req.user!.id, req.params.childId);
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'You do not have access to view this child\'s activities'
        });
      }

      // Get the child's activities with appropriate filtering
      const sharedChildren = await sharingService.getSharedChildren(req.user!.id);
      const sharedChild = sharedChildren.find(c => c.id === req.params.childId);

      if (!sharedChild) {
        return res.status(404).json({
          success: false,
          error: 'Child not found'
        });
      }

      // Apply additional filters
      let activities = sharedChild.activities;

      if (req.query.status) {
        activities = activities.filter(a => a.status === req.query.status);
      }

      if (req.query.startDate || req.query.endDate) {
        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : null;
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : null;

        activities = activities.filter(a => {
          const activityDate = (a as any).activity?.dateStart;
          if (!activityDate) return true;

          if (startDate && activityDate < startDate) return false;
          if (endDate && activityDate > endDate) return false;
          return true;
        });
      }

      // Format activities
      const formattedActivities = activities.map(childActivity => {
        const ca = childActivity as any;
        return {
          id: ca.id,
          status: ca.status,
          registeredAt: ca.registeredAt,
          completedAt: ca.completedAt,
          notes: sharedChild.shareProfile.canViewNotes ? ca.notes : null,
          rating: ca.rating,
          activity: {
            id: ca.activity.id,
            name: ca.activity.name,
            category: ca.activity.category,
            subcategory: ca.activity.subcategory,
            description: ca.activity.description,
            schedule: ca.activity.schedule,
            dateStart: ca.activity.dateStart,
            dateEnd: ca.activity.dateEnd,
            ageMin: ca.activity.ageMin,
            ageMax: ca.activity.ageMax,
            cost: ca.activity.cost,
            location: ca.activity.location ? {
              name: ca.activity.location.name,
              address: ca.activity.location.address,
              city: ca.activity.location.city
          } : null,
          provider: {
            name: ca.activity.provider.name,
            website: ca.activity.provider.website
          }
        }
      };
    });

      res.json({
        success: true,
        child: {
          id: sharedChild.id,
          name: sharedChild.name,
          age: Math.floor(
            (Date.now() - new Date(sharedChild.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
          )
        },
        activities: formattedActivities,
        permissions: {
          canViewInterested: sharedChild.shareProfile.canViewInterested,
          canViewRegistered: sharedChild.shareProfile.canViewRegistered,
          canViewCompleted: sharedChild.shareProfile.canViewCompleted,
          canViewNotes: sharedChild.shareProfile.canViewNotes
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch child activities'
      });
    }
  }
);

/**
 * Get all shared activities grouped by date
 * GET /api/shared-activities/calendar
 */
router.get(
  '/calendar',
  verifyToken,
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('childIds').optional(),
  handleValidationErrors,
  logActivity('view_shared_calendar'),
  async (req: Request, res: Response) => {
    try {
      const sharedChildren = await sharingService.getSharedChildren(req.user!.id);
      
      // Filter by selected children if provided
      let filteredChildren = sharedChildren;
      if (req.query.childIds) {
        const childIds = Array.isArray(req.query.childIds) 
          ? req.query.childIds 
          : (req.query.childIds as string).split(',');
        filteredChildren = sharedChildren.filter(c => childIds.includes(c.id));
      }

      // Collect all activities
      const allActivities: any[] = [];
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : null;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : null;

      for (const child of filteredChildren) {
        for (const childActivity of child.activities) {
          const ca = childActivity as any;
          const activity = ca.activity;
          
          // Filter by date range
          if (activity.dateStart) {
            if (startDate && activity.dateStart < startDate) continue;
            if (endDate && activity.dateStart > endDate) continue;
          }

          allActivities.push({
            childId: child.id,
            childName: child.name,
            childActivity: {
              id: childActivity.id,
              status: childActivity.status,
              notes: child.shareProfile.canViewNotes ? childActivity.notes : null
            },
            activity: {
              id: activity.id,
              name: activity.name,
              category: activity.category,
              dateStart: activity.dateStart,
              dateEnd: activity.dateEnd,
              schedule: activity.schedule,
              location: activity.location?.name,
              cost: activity.cost
            }
          });
        }
      }

      // Group by date
      const groupedActivities = allActivities.reduce((acc, item) => {
        const dateKey = item.activity.dateStart 
          ? new Date(item.activity.dateStart).toISOString().split('T')[0]
          : 'unscheduled';
        
        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }
        acc[dateKey].push(item);
        return acc;
      }, {} as Record<string, any[]>);

      res.json({
        success: true,
        calendar: groupedActivities,
        children: filteredChildren.map(c => ({
          id: c.id,
          name: c.name,
          avatarUrl: c.avatarUrl
        }))
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch calendar'
      });
    }
  }
);

/**
 * Get activity statistics for shared children
 * GET /api/shared-activities/stats
 */
router.get(
  '/stats',
  verifyToken,
  logActivity('view_shared_stats'),
  async (req: Request, res: Response) => {
    try {
      const sharedChildren = await sharingService.getSharedChildren(req.user!.id);

      // Calculate statistics
      const stats = {
        totalChildren: sharedChildren.length,
        totalActivities: 0,
        byStatus: {
          interested: 0,
          registered: 0,
          completed: 0,
          cancelled: 0
        },
        byCategory: {} as Record<string, number>,
        upcomingThisWeek: 0,
        totalCost: 0
      };

      const oneWeekFromNow = new Date();
      oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);

      for (const child of sharedChildren) {
        for (const childActivity of child.activities) {
          stats.totalActivities++;
          
          // Count by status
          stats.byStatus[childActivity.status as keyof typeof stats.byStatus]++;
          
          const ca = childActivity as any;
          // Count by category
          const category = ca.activity.category;
          stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
          
          // Count upcoming activities
          if (ca.activity.dateStart && 
              ca.activity.dateStart > new Date() &&
              ca.activity.dateStart < oneWeekFromNow &&
              childActivity.status === 'registered') {
            stats.upcomingThisWeek++;
          }
          
          // Sum cost for registered activities
          if (childActivity.status === 'registered') {
            stats.totalCost += ca.activity.cost || 0;
          }
        }
      }

      res.json({
        success: true,
        stats
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics'
      });
    }
  }
);

/**
 * Export shared activities to various formats
 * GET /api/shared-activities/export
 */
router.get(
  '/export',
  verifyToken,
  query('format').isIn(['json', 'csv', 'ical']),
  query('childIds').optional(),
  handleValidationErrors,
  logActivity('export_shared_activities'),
  async (req: Request, res: Response) => {
    try {
      const format = req.query.format as string;
      const sharedChildren = await sharingService.getSharedChildren(req.user!.id);
      
      // Filter by selected children if provided
      let filteredChildren = sharedChildren;
      if (req.query.childIds) {
        const childIds = Array.isArray(req.query.childIds) 
          ? req.query.childIds 
          : (req.query.childIds as string).split(',');
        filteredChildren = sharedChildren.filter(c => childIds.includes(c.id));
      }

      // Prepare data for export
      const exportData: any[] = [];
      for (const child of filteredChildren) {
        for (const childActivity of child.activities) {
          const ca = childActivity as any;
          const activity = ca.activity;
          exportData.push({
            childName: child.name,
            activityName: activity.name,
            category: activity.category,
            status: childActivity.status,
            dateStart: activity.dateStart,
            dateEnd: activity.dateEnd,
            location: activity.location?.name,
            cost: activity.cost,
            notes: child.shareProfile.canViewNotes ? childActivity.notes : null
          });
        }
      }

      if (format === 'json') {
        res.json({
          success: true,
          data: exportData,
          exportedAt: new Date().toISOString()
        });
      } else if (format === 'csv') {
        // Generate CSV
        const headers = ['Child Name', 'Activity Name', 'Category', 'Status', 'Start Date', 'End Date', 'Location', 'Cost', 'Notes'];
        const csvRows = [headers.join(',')];
        
        for (const row of exportData) {
          csvRows.push([
            `"${row.childName}"`,
            `"${row.activityName}"`,
            `"${row.category}"`,
            row.status,
            row.dateStart || '',
            row.dateEnd || '',
            `"${row.location || ''}"`,
            row.cost || '0',
            `"${row.notes || ''}"`
          ].join(','));
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=shared-activities.csv');
        res.send(csvRows.join('\n'));
      } else if (format === 'ical') {
        // Generate iCal format
        const icalEvents: string[] = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//Kids Activity Tracker//Shared Activities//EN'
        ];

        for (const row of exportData) {
          if (row.dateStart && row.status === 'registered') {
            icalEvents.push('BEGIN:VEVENT');
            icalEvents.push(`UID:${Date.now()}-${Math.random()}@kidsactivitytracker.com`);
            icalEvents.push(`DTSTART:${new Date(row.dateStart).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`);
            if (row.dateEnd) {
              icalEvents.push(`DTEND:${new Date(row.dateEnd).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`);
            }
            icalEvents.push(`SUMMARY:${row.activityName} - ${row.childName}`);
            icalEvents.push(`LOCATION:${row.location || ''}`);
            icalEvents.push(`DESCRIPTION:Category: ${row.category}\\nCost: $${row.cost || 0}${row.notes ? '\\nNotes: ' + row.notes : ''}`);
            icalEvents.push('END:VEVENT');
          }
        }

        icalEvents.push('END:VCALENDAR');

        res.setHeader('Content-Type', 'text/calendar');
        res.setHeader('Content-Disposition', 'attachment; filename=shared-activities.ics');
        res.send(icalEvents.join('\r\n'));
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to export activities'
      });
    }
  }
);

export default router;