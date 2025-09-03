import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Kids Activity Tracker API',
      version: '1.0.0',
      description: 'Comprehensive API documentation for the Kids Activity Tracker application',
      contact: {
        name: 'API Support',
        email: 'support@kidsactivitytracker.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://api.kidsactivitytracker.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        Activity: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            providerId: { type: 'string', format: 'uuid' },
            externalId: { type: 'string' },
            name: { type: 'string' },
            category: { type: 'string' },
            subcategory: { type: 'string', nullable: true },
            description: { type: 'string', nullable: true },
            schedule: { type: 'string', nullable: true },
            dateStart: { type: 'string', format: 'date-time', nullable: true },
            dateEnd: { type: 'string', format: 'date-time', nullable: true },
            registrationDate: { type: 'string', format: 'date-time', nullable: true },
            ageMin: { type: 'integer' },
            ageMax: { type: 'integer' },
            cost: { type: 'number', format: 'float' },
            spotsAvailable: { type: 'integer' },
            totalSpots: { type: 'integer' },
            locationId: { type: 'string', format: 'uuid', nullable: true },
            registrationUrl: { type: 'string', nullable: true },
            courseId: { type: 'string', nullable: true },
            isActive: { type: 'boolean' },
            lastSeenAt: { type: 'string', format: 'date-time' },
            registrationStatus: { type: 'string' },
            activityTypeId: { type: 'string', format: 'uuid', nullable: true },
            activitySubtypeId: { type: 'string', format: 'uuid', nullable: true }
          }
        },
        ActivityType: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            code: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            iconName: { type: 'string', nullable: true },
            imageUrl: { type: 'string', nullable: true },
            displayOrder: { type: 'integer' }
          }
        },
        Category: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            ageMin: { type: 'integer', nullable: true },
            ageMax: { type: 'integer', nullable: true },
            requiresParent: { type: 'boolean' },
            displayOrder: { type: 'integer' },
            activityCount: { type: 'integer' }
          }
        },
        Location: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            address: { type: 'string', nullable: true },
            postalCode: { type: 'string', nullable: true },
            latitude: { type: 'number', format: 'float', nullable: true },
            longitude: { type: 'number', format: 'float', nullable: true },
            facility: { type: 'string', nullable: true },
            fullAddress: { type: 'string', nullable: true },
            mapUrl: { type: 'string', nullable: true },
            phoneNumber: { type: 'string', nullable: true },
            website: { type: 'string', nullable: true },
            cityId: { type: 'string', format: 'uuid' },
            activityCount: { type: 'integer' }
          }
        },
        City: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            province: { type: 'string' },
            country: { type: 'string' },
            venueCount: { type: 'integer' },
            activityCount: { type: 'integer' }
          }
        },
        Child: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            dateOfBirth: { type: 'string', format: 'date' },
            interests: { 
              type: 'array',
              items: { type: 'string' }
            },
            notes: { type: 'string', nullable: true },
            isActive: { type: 'boolean' },
            userId: { type: 'string', format: 'uuid' }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            isEmailVerified: { type: 'boolean' },
            preferences: { type: 'object' }
          }
        },
        PaginationResponse: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
            limit: { type: 'integer' },
            offset: { type: 'integer' },
            pages: { type: 'integer' }
          }
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string', nullable: true }
          }
        },
        Invitation: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            senderId: { type: 'string', format: 'uuid' },
            recipientEmail: { type: 'string', format: 'email' },
            recipientUserId: { type: 'string', format: 'uuid', nullable: true },
            status: { type: 'string', enum: ['pending', 'accepted', 'declined', 'expired'] },
            message: { type: 'string', nullable: true },
            token: { type: 'string' },
            expiresAt: { type: 'string', format: 'date-time' },
            acceptedAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            sender: { '$ref': '#/components/schemas/User' },
            recipient: { '$ref': '#/components/schemas/User' }
          }
        },
        ActivityShare: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            sharingUserId: { type: 'string', format: 'uuid' },
            sharedWithUserId: { type: 'string', format: 'uuid' },
            permissionLevel: { type: 'string' },
            expiresAt: { type: 'string', format: 'date-time', nullable: true },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            sharingUser: { '$ref': '#/components/schemas/User' },
            sharedWithUser: { '$ref': '#/components/schemas/User' },
            profiles: { 
              type: 'array',
              items: { '$ref': '#/components/schemas/ActivityShareProfile' }
            }
          }
        },
        ActivityShareProfile: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            activityShareId: { type: 'string', format: 'uuid' },
            childId: { type: 'string', format: 'uuid' },
            canViewInterested: { type: 'boolean' },
            canViewRegistered: { type: 'boolean' },
            canViewCompleted: { type: 'boolean' },
            canViewNotes: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            child: { '$ref': '#/components/schemas/Child' }
          }
        },
        ChildActivity: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            childId: { type: 'string', format: 'uuid' },
            activityId: { type: 'string', format: 'uuid' },
            status: { 
              type: 'string', 
              enum: ['interested', 'registered', 'completed', 'cancelled']
            },
            registeredAt: { type: 'string', format: 'date-time', nullable: true },
            completedAt: { type: 'string', format: 'date-time', nullable: true },
            notes: { type: 'string', nullable: true },
            rating: { type: 'integer', minimum: 1, maximum: 5, nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            activity: { '$ref': '#/components/schemas/Activity' },
            child: { '$ref': '#/components/schemas/Child' }
          }
        },
        Favorite: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            activityId: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            notifyOnChange: { type: 'boolean' },
            activity: { '$ref': '#/components/schemas/Activity' },
            user: { '$ref': '#/components/schemas/User' }
          }
        },
        ActivitySubtype: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            activityTypeId: { type: 'string', format: 'uuid' },
            code: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            imageUrl: { type: 'string', nullable: true },
            displayOrder: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            activityType: { '$ref': '#/components/schemas/ActivityType' }
          }
        },
        ActivitySession: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            activityId: { type: 'string', format: 'uuid' },
            sessionNumber: { type: 'integer', nullable: true },
            date: { type: 'string', nullable: true },
            dayOfWeek: { type: 'string', nullable: true },
            startTime: { type: 'string', nullable: true },
            endTime: { type: 'string', nullable: true },
            location: { type: 'string', nullable: true },
            subLocation: { type: 'string', nullable: true },
            instructor: { type: 'string', nullable: true },
            notes: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        ActivityPrerequisite: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            activityId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            url: { type: 'string', nullable: true },
            courseId: { type: 'string', nullable: true },
            isRequired: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Provider: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            website: { type: 'string' },
            scraperConfig: { type: 'object' },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            region: { type: 'string', nullable: true },
            contactInfo: { type: 'object', nullable: true },
            platform: { type: 'string', nullable: true }
          }
        },
        ScrapeJob: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            providerId: { type: 'string', format: 'uuid' },
            status: { 
              type: 'string', 
              enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']
            },
            startedAt: { type: 'string', format: 'date-time', nullable: true },
            completedAt: { type: 'string', format: 'date-time', nullable: true },
            activitiesFound: { type: 'integer' },
            activitiesCreated: { type: 'integer' },
            activitiesUpdated: { type: 'integer' },
            activitiesRemoved: { type: 'integer' },
            errorMessage: { type: 'string', nullable: true },
            errorDetails: { type: 'object', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            provider: { '$ref': '#/components/schemas/Provider' }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints'
      },
      {
        name: 'Activities',
        description: 'Activity search, filtering, and details endpoints'
      },
      {
        name: 'Categories',
        description: 'Age-based category management (5 categories total)'
      },
      {
        name: 'Activity Types',
        description: 'Subject-based activity type management (22 types total)'
      },
      {
        name: 'Locations',
        description: 'Location-based browsing: cities → venues → activities'
      },
      {
        name: 'Children',
        description: 'Child profile management and preferences'
      },
      {
        name: 'Favorites',
        description: 'User favorites management'
      },
      {
        name: 'Child Activities',
        description: 'Link children to activities, history, and recommendations'
      },
      {
        name: 'Sharing',
        description: 'Activity sharing between users'
      },
      {
        name: 'Invitations',
        description: 'User invitation system'
      },
      {
        name: 'Reference',
        description: 'Reference data and system information'
      }
    ]
  },
  apis: [
    './src/routes/*.ts',
    './src/swagger/schemas/*.ts',
    './src/swagger/routes.yaml'
  ]
};

export const swaggerSpec = swaggerJsdoc(options);
export { swaggerUi };