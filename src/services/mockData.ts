import { Camp, ActivityType } from '../types';

// Mock data based on NVRC's typical camps
export const mockCamps: Camp[] = [
  {
    id: '1',
    name: 'Summer Adventure Camp',
    provider: 'NVRC',
    description: 'A fun-filled week of outdoor activities, sports, and creative arts for kids.',
    activityType: [ActivityType.CAMPS, ActivityType.SPORTS],
    ageRange: { min: 6, max: 12 },
    dateRange: {
      start: new Date('2024-07-08'),
      end: new Date('2024-07-12')
    },
    schedule: {
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      startTime: '9:00 AM',
      endTime: '4:00 PM'
    },
    location: {
      name: 'North Vancouver Recreation Centre',
      address: '851 W Queens Rd, North Vancouver, BC'
    },
    cost: 285,
    spotsAvailable: 5,
    totalSpots: 20,
    registrationUrl: 'https://www.nvrc.ca/register',
    scrapedAt: new Date()
  },
  {
    id: '2',
    name: 'Little Artists Workshop',
    provider: 'NVRC',
    description: 'Explore creativity through painting, drawing, and crafts in this arts-focused program.',
    activityType: [ActivityType.VISUAL_ARTS, ActivityType.EARLY_YEARS],
    ageRange: { min: 4, max: 6 },
    dateRange: {
      start: new Date('2024-07-15'),
      end: new Date('2024-07-19')
    },
    schedule: {
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      startTime: '1:00 PM',
      endTime: '3:00 PM'
    },
    location: {
      name: 'Lynn Valley Library',
      address: '1277 Lynn Valley Rd, North Vancouver, BC'
    },
    cost: 150,
    spotsAvailable: 8,
    totalSpots: 12,
    registrationUrl: 'https://www.nvrc.ca/register',
    scrapedAt: new Date()
  },
  {
    id: '3',
    name: 'Swim Kids Level 3',
    provider: 'NVRC',
    description: 'Continue developing swimming skills with focus on endurance and proper technique.',
    activityType: [ActivityType.SWIMMING],
    ageRange: { min: 6, max: 10 },
    dateRange: {
      start: new Date('2024-07-08'),
      end: new Date('2024-08-02')
    },
    schedule: {
      days: ['Tuesday', 'Thursday'],
      startTime: '4:30 PM',
      endTime: '5:15 PM'
    },
    location: {
      name: 'Harry Jerome Recreation Centre',
      address: '123 E 23rd St, North Vancouver, BC'
    },
    cost: 120,
    spotsAvailable: 2,
    totalSpots: 8,
    registrationUrl: 'https://www.nvrc.ca/register',
    scrapedAt: new Date()
  },
  {
    id: '4',
    name: 'Karate for Beginners',
    provider: 'NVRC',
    description: 'Introduction to martial arts focusing on discipline, respect, and basic techniques.',
    activityType: [ActivityType.MARTIAL_ARTS],
    ageRange: { min: 7, max: 12 },
    dateRange: {
      start: new Date('2024-07-10'),
      end: new Date('2024-08-14')
    },
    schedule: {
      days: ['Wednesday', 'Friday'],
      startTime: '5:00 PM',
      endTime: '6:00 PM'
    },
    location: {
      name: 'Delbrook Community Recreation Centre',
      address: '600 W Queens Rd, North Vancouver, BC'
    },
    cost: 180,
    spotsAvailable: 10,
    totalSpots: 15,
    registrationUrl: 'https://www.nvrc.ca/register',
    scrapedAt: new Date()
  },
  {
    id: '5',
    name: 'Dance & Movement',
    provider: 'NVRC',
    description: 'Explore different dance styles including ballet, jazz, and creative movement.',
    activityType: [ActivityType.DANCE, ActivityType.EARLY_YEARS],
    ageRange: { min: 4, max: 7 },
    dateRange: {
      start: new Date('2024-07-22'),
      end: new Date('2024-08-16')
    },
    schedule: {
      days: ['Monday', 'Wednesday'],
      startTime: '10:00 AM',
      endTime: '11:00 AM'
    },
    location: {
      name: 'North Vancouver Recreation Centre',
      address: '851 W Queens Rd, North Vancouver, BC'
    },
    cost: 140,
    spotsAvailable: 0,
    totalSpots: 10,
    registrationUrl: 'https://www.nvrc.ca/register',
    scrapedAt: new Date()
  },
  {
    id: '6',
    name: 'Parent & Tot Play Time',
    provider: 'NVRC',
    description: 'Interactive play sessions for toddlers and their caregivers with songs, games, and activities.',
    activityType: [ActivityType.EARLY_YEARS, ActivityType.LEARN_AND_PLAY],
    ageRange: { min: 1, max: 3 },
    dateRange: {
      start: new Date('2024-07-09'),
      end: new Date('2024-08-13')
    },
    schedule: {
      days: ['Tuesday'],
      startTime: '9:30 AM',
      endTime: '10:30 AM'
    },
    location: {
      name: 'Lynn Valley Library',
      address: '1277 Lynn Valley Rd, North Vancouver, BC'
    },
    cost: 60,
    spotsAvailable: 4,
    totalSpots: 8,
    registrationUrl: 'https://www.nvrc.ca/register',
    scrapedAt: new Date()
  }
];

// Function to filter camps based on criteria
export function filterCamps(camps: Camp[], filter: any): Camp[] {
  return camps.filter(camp => {
    // Filter by activity types
    if (filter.activityTypes?.length > 0) {
      const hasActivity = camp.activityType.some(type => 
        filter.activityTypes.includes(type)
      );
      if (!hasActivity) return false;
    }

    // Filter by age range
    if (filter.minAge !== undefined || filter.maxAge !== undefined) {
      const minAge = filter.minAge || 0;
      const maxAge = filter.maxAge || 100;
      if (camp.ageRange.max < minAge || camp.ageRange.min > maxAge) {
        return false;
      }
    }

    // Filter by cost
    if (filter.maxCost && camp.cost > filter.maxCost) {
      return false;
    }

    // Filter by availability
    if (filter.availableOnly && camp.spotsAvailable === 0) {
      return false;
    }

    return true;
  });
}