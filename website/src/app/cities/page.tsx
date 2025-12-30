// Force dynamic rendering to avoid build-time API fetching
export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import Link from 'next/link';
import { api, City } from '@/lib/api';
import CitySearch from '@/components/CitySearch';

export const metadata: Metadata = {
  title: 'Supported Cities | Kids Activity Tracker',
  description: 'Browse all cities where Kids Activity Tracker provides activity listings for children. Find swimming, sports, arts, and educational programs.',
};

async function getCities(): Promise<City[]> {
  try {
    const response = await api.getCities();
    return response.cities.sort((a, b) => b.activityCount - a.activityCount);
  } catch (error) {
    console.error('Failed to fetch cities:', error);
    return [];
  }
}

export default async function CitiesPage() {
  const cities = await getCities();

  return (
    <div className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Find Activities in Your{' '}
            <span className="gradient-text">City</span>
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            We currently support {cities.filter(c => c.isActive).length} cities across Canada.
            Search for your city or browse the list below.
          </p>
        </div>

        {/* City Search and Grid */}
        <CitySearch cities={cities} />

        {/* Request City CTA */}
        <div className="mt-16 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Don&apos;t see your city?
          </h2>
          <p className="text-gray-600 mb-6 max-w-xl mx-auto">
            We&apos;re always expanding! Let us know which city you&apos;d like us to add next,
            and we&apos;ll prioritize based on demand.
          </p>
          <Link
            href="/request-city"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 transition-opacity"
          >
            Request a City
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
