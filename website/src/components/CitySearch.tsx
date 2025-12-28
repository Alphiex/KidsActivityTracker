'use client';

import { useState, useMemo } from 'react';
import { City } from '@/lib/api';
import CityCard from './CityCard';

interface CitySearchProps {
  cities: City[];
}

// Get unique provinces from cities
function getProvinces(cities: City[]): string[] {
  const provinces = new Set(cities.map((city) => city.province));
  return Array.from(provinces).sort();
}

export default function CitySearch({ cities }: CitySearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvince, setSelectedProvince] = useState<string>('all');

  const provinces = useMemo(() => getProvinces(cities), [cities]);

  const filteredCities = useMemo(() => {
    return cities.filter((city) => {
      const matchesSearch = city.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesProvince = selectedProvince === 'all' || city.province === selectedProvince;
      return matchesSearch && matchesProvince && city.isActive;
    });
  }, [cities, searchQuery, selectedProvince]);

  return (
    <div>
      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        {/* Search Input */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search cities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Province Filter */}
        <select
          value={selectedProvince}
          onChange={(e) => setSelectedProvince(e.target.value)}
          className="px-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none min-w-[180px]"
        >
          <option value="all">All Provinces</option>
          {provinces.map((province) => (
            <option key={province} value={province}>
              {province}
            </option>
          ))}
        </select>
      </div>

      {/* Results Count */}
      <p className="text-gray-600 mb-6">
        Showing {filteredCities.length} of {cities.filter(c => c.isActive).length} cities
      </p>

      {/* City Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredCities.map((city) => (
          <CityCard key={city.id} city={city} />
        ))}
      </div>

      {/* Empty State */}
      {filteredCities.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No cities found</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery
              ? `No cities match "${searchQuery}"`
              : 'No cities available for this province'}
          </p>
          <a
            href="/request-city"
            className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium"
          >
            Request a city
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}
