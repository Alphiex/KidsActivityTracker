/**
 * Distance calculation utilities for location-based filtering
 * Uses Haversine formula for accurate great-circle distance
 */

// Earth's radius in kilometers
const EARTH_RADIUS_KM = 6371;

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate the distance between two points using the Haversine formula
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Calculate a bounding box for efficient pre-filtering
 * This creates a square bounding box that fully contains the circular radius
 * @param lat Center latitude
 * @param lon Center longitude
 * @param radiusKm Radius in kilometers
 * @returns Bounding box coordinates
 */
export function getBoundingBox(
  lat: number,
  lon: number,
  radiusKm: number
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  // Latitude: 1 degree = ~111 km
  const latDelta = radiusKm / 111;

  // Longitude: varies by latitude, 1 degree = ~111 * cos(lat) km
  const lonDelta = radiusKm / (111 * Math.cos(toRadians(lat)));

  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLon: lon - lonDelta,
    maxLon: lon + lonDelta,
  };
}

/**
 * Add distance to an array of activities and filter by radius
 * @param activities Array of activities with latitude/longitude
 * @param userLat User's latitude
 * @param userLon User's longitude
 * @param radiusKm Maximum distance in kilometers
 * @returns Activities within radius, with distance field added
 */
export function filterActivitiesByDistance<
  T extends { latitude?: number | null; longitude?: number | null }
>(
  activities: T[],
  userLat: number,
  userLon: number,
  radiusKm: number
): (T & { distance: number })[] {
  return activities
    .filter((activity) => {
      // Skip activities without coordinates
      if (activity.latitude == null || activity.longitude == null) {
        return false;
      }
      return true;
    })
    .map((activity) => {
      const distance = calculateDistance(
        userLat,
        userLon,
        activity.latitude!,
        activity.longitude!
      );
      return { ...activity, distance };
    })
    .filter((activity) => activity.distance <= radiusKm);
}

/**
 * Sort activities by distance (closest first)
 * @param activities Activities with distance field
 * @returns Sorted activities
 */
export function sortByDistance<T extends { distance: number }>(
  activities: T[]
): T[] {
  return [...activities].sort((a, b) => a.distance - b.distance);
}

/**
 * Valid radius options in kilometers
 */
export const VALID_RADIUS_OPTIONS = [5, 10, 25, 50, 100] as const;
export type RadiusOption = (typeof VALID_RADIUS_OPTIONS)[number];

/**
 * Validate radius parameter
 * @param radiusKm Radius to validate
 * @returns True if valid radius option
 */
export function isValidRadius(radiusKm: number): radiusKm is RadiusOption {
  return VALID_RADIUS_OPTIONS.includes(radiusKm as RadiusOption);
}
