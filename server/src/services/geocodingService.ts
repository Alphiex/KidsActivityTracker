/**
 * Geocoding Service
 * Uses Google Maps Geocoding API to convert addresses to coordinates
 */

import { prisma } from '../lib/prisma';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GEOCODE_API_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  placeId: string;
}

class GeocodingService {
  private static instance: GeocodingService;

  static getInstance(): GeocodingService {
    if (!GeocodingService.instance) {
      GeocodingService.instance = new GeocodingService();
    }
    return GeocodingService.instance;
  }

  /**
   * Geocode an address using Google Maps API
   */
  async geocodeAddress(address: string, city?: string, province?: string): Promise<GeocodeResult | null> {
    if (!GOOGLE_MAPS_API_KEY) {
      console.warn('[Geocoding] Google Maps API key not configured');
      return null;
    }

    try {
      // Build full address string
      const parts = [address, city, province, 'Canada'].filter(Boolean);
      const fullAddress = parts.join(', ');

      const params = new URLSearchParams({
        address: fullAddress,
        key: GOOGLE_MAPS_API_KEY,
        region: 'ca', // Bias results to Canada
      });

      const response = await fetch(`${GEOCODE_API_URL}?${params}`);
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        return {
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
          formattedAddress: result.formatted_address,
          placeId: result.place_id,
        };
      }

      if (data.status === 'ZERO_RESULTS') {
        console.log(`[Geocoding] No results for: ${fullAddress}`);
        return null;
      }

      console.error(`[Geocoding] API error: ${data.status}`, data.error_message);
      return null;
    } catch (error) {
      console.error('[Geocoding] Error:', error);
      return null;
    }
  }

  /**
   * Geocode a single location and update the database
   */
  async geocodeLocation(locationId: string): Promise<boolean> {
    const location = await prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location) {
      console.log(`[Geocoding] Location not found: ${locationId}`);
      return false;
    }

    // Skip if already geocoded
    if (location.latitude && location.longitude) {
      console.log(`[Geocoding] Location already geocoded: ${location.name}`);
      return true;
    }

    // Build address from location fields
    const address = location.fullAddress || location.address || location.name;
    const result = await this.geocodeAddress(address, location.city, location.province);

    if (result) {
      await prisma.location.update({
        where: { id: locationId },
        data: {
          latitude: result.latitude,
          longitude: result.longitude,
          fullAddress: result.formattedAddress,
          placeId: result.placeId,
        },
      });
      console.log(`[Geocoding] Updated location: ${location.name} -> (${result.latitude}, ${result.longitude})`);
      return true;
    }

    return false;
  }

  /**
   * Geocode all locations missing coordinates
   */
  async geocodeAllLocations(options?: { 
    limit?: number; 
    delayMs?: number;
  }): Promise<{ success: number; failed: number; skipped: number }> {
    const { limit = 100, delayMs = 200 } = options || {};

    // Find locations without coordinates
    const locations = await prisma.location.findMany({
      where: {
        OR: [
          { latitude: null },
          { longitude: null },
        ],
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    console.log(`[Geocoding] Found ${locations.length} locations to geocode`);

    let success = 0;
    let failed = 0;
    let skipped = 0;

    for (const location of locations) {
      // Skip locations without enough address info
      if (!location.address && !location.fullAddress && !location.name) {
        skipped++;
        continue;
      }

      const result = await this.geocodeLocation(location.id);
      if (result) {
        success++;
      } else {
        failed++;
      }

      // Rate limit to avoid hitting API limits
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    console.log(`[Geocoding] Complete: ${success} success, ${failed} failed, ${skipped} skipped`);
    return { success, failed, skipped };
  }

  /**
   * Copy coordinates from location to activities that don't have them
   */
  async syncActivityCoordinates(options?: { limit?: number }): Promise<number> {
    const { limit = 1000 } = options || {};

    // Find activities without coordinates but with a location that has coordinates
    const activities = await prisma.activity.findMany({
      where: {
        AND: [
          { OR: [{ latitude: null }, { longitude: null }] },
          { locationId: { not: null } },
        ],
      },
      include: {
        location: true,
      },
      take: limit,
    });

    let updated = 0;

    for (const activity of activities) {
      if (activity.location?.latitude && activity.location?.longitude) {
        await prisma.activity.update({
          where: { id: activity.id },
          data: {
            latitude: activity.location.latitude,
            longitude: activity.location.longitude,
          },
        });
        updated++;
      }
    }

    console.log(`[Geocoding] Synced coordinates to ${updated} activities`);
    return updated;
  }
}

export const geocodingService = GeocodingService.getInstance();
export default geocodingService;
