import axios, { AxiosInstance } from 'axios';
import { Activity, Filter } from '../types';
import { API_CONFIG } from '../config/api';

class ScraperService {
  private static instance: ScraperService;
  private api: AxiosInstance;

  private constructor() {
    this.api = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  static getInstance(): ScraperService {
    if (!ScraperService.instance) {
      ScraperService.instance = new ScraperService();
    }
    return ScraperService.instance;
  }

  async scrapeNVRC(): Promise<Activity[]> {
    try {
      console.log('Fetching activities from backend API...');
      const response = await this.api.post(API_CONFIG.ENDPOINTS.SCRAPE_NVRC);
      
      if (response.data.success && response.data.activities) {
        console.log(`Received ${response.data.activities.length} activities from API`);
        
        // Convert date strings to Date objects
        const activities = response.data.activities.map((activity: any) => ({
          ...activity,
          dateRange: {
            start: new Date(activity.dateRange.start),
            end: new Date(activity.dateRange.end),
          },
          scrapedAt: new Date(activity.scrapedAt),
        }));
        
        return activities;
      }
      
      console.log('No activities returned from API');
      return [];
    } catch (error: any) {
      console.error('Error fetching activities from API:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        config: error.config
      });
      
      if (error.code === 'ECONNREFUSED') {
        console.error('❌ Backend server not running! Please start the backend server.');
        console.error('Run: npm run backend');
        throw new Error('Backend server is not running. Please start the backend server.');
      }
      
      if (error.response?.status === 404) {
        console.error('❌ API endpoint not found. Make sure the backend is up to date.');
        throw new Error('API endpoint not found. Please update the backend server.');
      }
      
      throw new Error(error.response?.data?.message || 'Failed to fetch activities');
    }
  }

  async searchActivities(filter: Filter): Promise<Activity[]> {
    try {
      // Convert date objects to ISO strings
      const searchParams = {
        ...filter,
        dateRange: filter.dateRange ? {
          start: filter.dateRange.start.toISOString(),
          end: filter.dateRange.end.toISOString(),
        } : undefined,
      };

      const response = await this.api.post(API_CONFIG.ENDPOINTS.SEARCH_ACTIVITIES, searchParams);
      
      if (response.data.success && response.data.activities) {
        return response.data.activities.map((activity: any) => ({
          ...activity,
          dateRange: {
            start: new Date(activity.dateRange.start),
            end: new Date(activity.dateRange.end),
          },
          scrapedAt: new Date(activity.scrapedAt),
        }));
      }
      
      return [];
    } catch (error: any) {
      console.error('Error searching activities:', error);
      throw new Error(error.response?.data?.message || 'Failed to search activities');
    }
  }

  async getActivityDetails(activityId: string): Promise<Activity | null> {
    try {
      const response = await this.api.get(`${API_CONFIG.ENDPOINTS.ACTIVITY_DETAILS}/${activityId}`);
      
      if (response.data.success && response.data.activity) {
        const activity = response.data.activity;
        return {
          ...activity,
          dateRange: {
            start: new Date(activity.dateRange.start),
            end: new Date(activity.dateRange.end),
          },
          scrapedAt: new Date(activity.scrapedAt),
        };
      }
      
      return null;
    } catch (error: any) {
      console.error('Error fetching activity details:', error);
      
      // Fallback to searching in all activities
      const activities = await this.scrapeNVRC();
      return activities.find(activity => activity.id === activityId) || null;
    }
  }

  async refreshActivities(): Promise<Activity[]> {
    try {
      const response = await this.api.post(API_CONFIG.ENDPOINTS.REFRESH, {
        force: true
      });
      
      if (response.data.success && response.data.activities) {
        return response.data.activities.map((activity: any) => ({
          ...activity,
          dateRange: {
            start: new Date(activity.dateRange.start),
            end: new Date(activity.dateRange.end),
          },
          scrapedAt: new Date(activity.scrapedAt),
        }));
      }
      
      return [];
    } catch (error: any) {
      console.error('Error refreshing activities:', error);
      throw new Error(error.response?.data?.message || 'Failed to refresh activities');
    }
  }
}

export default ScraperService;