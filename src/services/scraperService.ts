import axios from 'axios';
import { Camp, Filter } from '../types';
import API_CONFIG from '../config/api';

export class ScraperService {
  private static instance: ScraperService;
  private apiClient;

  private constructor() {
    this.apiClient = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
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

  async scrapeNVRC(): Promise<Camp[]> {
    try {
      console.log('Fetching camps from backend API...');
      const response = await this.apiClient.get(API_CONFIG.ENDPOINTS.SCRAPE_NVRC);
      
      if (response.data.success && response.data.camps) {
        console.log(`Received ${response.data.camps.length} camps from API`);
        
        // Convert date strings to Date objects
        const camps = response.data.camps.map((camp: any) => ({
          ...camp,
          dateRange: {
            start: new Date(camp.dateRange.start),
            end: new Date(camp.dateRange.end),
          },
          scrapedAt: new Date(camp.scrapedAt),
        }));
        
        return camps;
      }
      
      console.log('No camps returned from API');
      return [];
    } catch (error: any) {
      console.error('Error fetching camps from API:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        config: error.config
      });
      
      if (error.code === 'ECONNREFUSED') {
        console.error('❌ Backend server not running! Please start the backend server.');
        // Show a user-friendly error
        throw new Error('Unable to connect to backend server. Please ensure the server is running.');
      }
      
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        throw new Error('Network error. Please check your connection and ensure the backend server is running on http://127.0.0.1:3000');
      }
      
      throw error;
    }
  }

  async searchCamps(filter: Filter): Promise<Camp[]> {
    try {
      // Try to use the search endpoint
      const params = new URLSearchParams();
      
      if (filter.activityTypes?.length) {
        params.append('activityTypes', filter.activityTypes.join(','));
      }
      if (filter.ageRange?.min) {
        params.append('minAge', filter.ageRange.min.toString());
      }
      if (filter.ageRange?.max) {
        params.append('maxAge', filter.ageRange.max.toString());
      }
      if (filter.maxCost) {
        params.append('maxCost', filter.maxCost.toString());
      }
      
      const response = await this.apiClient.get(
        `${API_CONFIG.ENDPOINTS.SEARCH_CAMPS}?${params.toString()}`
      );
      
      if (response.data.success && response.data.camps) {
        return response.data.camps.map((camp: any) => ({
          ...camp,
          dateRange: {
            start: new Date(camp.dateRange.start),
            end: new Date(camp.dateRange.end),
          },
          scrapedAt: new Date(camp.scrapedAt),
        }));
      }
    } catch (error) {
      console.error('Search API error:', error);
    }
    
    // If API failed, return empty array
    return [];
  }

  async getCampDetails(campId: string): Promise<Camp | null> {
    try {
      const response = await this.apiClient.get(`${API_CONFIG.ENDPOINTS.CAMP_DETAILS}/${campId}`);
      
      if (response.data.success && response.data.camp) {
        const camp = response.data.camp;
        return {
          ...camp,
          dateRange: {
            start: new Date(camp.dateRange.start),
            end: new Date(camp.dateRange.end),
          },
          scrapedAt: new Date(camp.scrapedAt),
        };
      }
    } catch (error) {
      console.error('Error fetching camp details:', error);
    }
    
    // Fallback to searching in all camps
    const camps = await this.scrapeNVRC();
    return camps.find(camp => camp.id === campId) || null;
  }

  async refreshCamps(): Promise<Camp[]> {
    // Force refresh by adding a timestamp to bypass cache
    try {
      const response = await this.apiClient.get(
        `${API_CONFIG.ENDPOINTS.SCRAPE_NVRC}?refresh=${Date.now()}`
      );
      
      if (response.data.success && response.data.camps) {
        return response.data.camps.map((camp: any) => ({
          ...camp,
          dateRange: {
            start: new Date(camp.dateRange.start),
            end: new Date(camp.dateRange.end),
          },
          scrapedAt: new Date(camp.scrapedAt),
        }));
      }
    } catch (error) {
      console.error('Error refreshing camps:', error);
    }
    
    return this.scrapeNVRC();
  }
}