'use client';

import Link from 'next/link';
import { City } from '@/lib/api';
import CityCard from './CityCard';
import { useCityCount, formatCityCount } from '@/lib/CityCountContext';

interface CityGridProps {
  cities: City[];
  showViewAll?: boolean;
  maxDisplay?: number;
}

export default function CityGrid({ cities, showViewAll = true, maxDisplay }: CityGridProps) {
  const displayCities = maxDisplay ? cities.slice(0, maxDisplay) : cities;
  const cityCount = useCityCount();
  const displayCount = formatCityCount(cityCount);

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl font-bold text-gray-900">
                {displayCount} Canadian <span className="gradient-text">Cities</span>
              </h2>
              <span className="text-2xl">🇨🇦</span>
            </div>
            <p className="text-gray-600">
              Find activities across Canada - and growing!
            </p>
          </div>
          {showViewAll && (
            <Link
              href="/cities"
              className="inline-flex items-center gap-2 text-[#E8638B] hover:text-[#D53F8C] font-medium"
            >
              View all cities
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {displayCities.map((city) => (
            <CityCard key={city.id} city={city} />
          ))}
        </div>

        {displayCities.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No cities available at the moment.</p>
          </div>
        )}
      </div>
    </section>
  );
}
