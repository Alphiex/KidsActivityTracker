import { API_URL } from './constants';

// Internal API response type (from the server)
interface CityApiData {
  city: string;
  province: string | null;
  venueCount: number;
  activityCount: number;
}

// City type for frontend use
export interface City {
  id: string;
  name: string;
  slug: string;
  province: string;
  activityCount: number;
  venueCount: number;
  isActive: boolean;
}

interface CitiesApiResponse {
  success: boolean;
  data: CityApiData[];
  total: number;
}

export interface CitiesResponse {
  success: boolean;
  cities: City[];
  total: number;
}

export interface CityRequestPayload {
  cityName: string;
  province: string;
  email: string;
  sites?: string;
  notes?: string;
}

export interface VendorRegistrationPayload {
  code: string;
  name: string;
  email: string;
  website?: string;
  contactName?: string;
}

// Helper to create slug from city name
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-');
}

// API Client
class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_URL;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.error || error.message || 'Request failed');
    }

    return response.json();
  }

  // Cities
  async getCities(): Promise<CitiesResponse> {
    const response = await this.fetch<CitiesApiResponse>('/api/v1/cities');

    // Transform API response to frontend format
    const cities: City[] = response.data.map((cityData, index) => ({
      id: `city-${index}`,
      name: cityData.city,
      slug: createSlug(cityData.city),
      province: cityData.province || 'Unknown',
      activityCount: cityData.activityCount,
      venueCount: cityData.venueCount,
      isActive: cityData.activityCount > 0,
    }));

    return {
      success: response.success,
      cities,
      total: response.total,
    };
  }

  async requestCity(data: CityRequestPayload): Promise<{ success: boolean; message: string }> {
    return this.fetch('/api/v1/cities/request', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Vendor Registration
  async registerVendor(
    data: VendorRegistrationPayload,
    authToken: string
  ): Promise<{ success: boolean; vendor: unknown; message: string }> {
    return this.fetch('/api/vendor/auth/register', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();

// Utility function to get city count (cached)
export async function getCityCount(): Promise<number> {
  try {
    const response = await api.getCities();
    return response.cities.filter(city => city.isActive).length;
  } catch (error) {
    console.error('Failed to fetch city count:', error);
    return 0;
  }
}
