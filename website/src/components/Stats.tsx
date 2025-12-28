'use client';

import { useEffect, useState } from 'react';
import { useCityCount, formatCityCount } from '@/lib/CityCountContext';
import { API_URL } from '@/lib/constants';

interface Stat {
  value: string;
  label: string;
  color: string;
}

interface StatsData {
  totalActivities: number;
  totalLocations: number;
}

function formatNumber(num: number): string {
  if (num >= 10000) {
    return `${Math.floor(num / 1000)}k+`;
  } else if (num >= 1000) {
    // Round down to nearest 100
    const rounded = Math.floor(num / 100) * 100;
    return `${rounded.toLocaleString()}+`;
  } else if (num >= 100) {
    // Round down to nearest 50
    const rounded = Math.floor(num / 50) * 50;
    return `${rounded}+`;
  }
  return num.toString();
}

export default function Stats() {
  const [isVisible, setIsVisible] = useState(false);
  const [statsData, setStatsData] = useState<StatsData>({ totalActivities: 0, totalLocations: 0 });
  const cityCount = useCityCount();
  const displayCount = formatCityCount(cityCount);

  useEffect(() => {
    setIsVisible(true);

    // Fetch stats from cities API
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_URL}/api/v1/cities`);
        if (response.ok) {
          const data = await response.json();
          if (data.data && Array.isArray(data.data)) {
            const totalActivities = data.data.reduce(
              (sum: number, city: { activityCount: number }) => sum + (city.activityCount || 0),
              0
            );
            const totalLocations = data.data.reduce(
              (sum: number, city: { venueCount: number }) => sum + (city.venueCount || 0),
              0
            );
            setStatsData({ totalActivities, totalLocations });
          }
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();
  }, []);

  const stats: Stat[] = [
    {
      value: statsData.totalActivities > 0 ? formatNumber(statsData.totalActivities) : '...',
      label: 'Activities',
      color: 'from-purple-500 to-pink-500'
    },
    {
      value: statsData.totalLocations > 0 ? formatNumber(statsData.totalLocations) : '...',
      label: 'Locations',
      color: 'from-green-500 to-emerald-500'
    },
    { value: displayCount, label: 'Cities', color: 'from-blue-500 to-cyan-500' },
    { value: 'Daily', label: 'Updates', color: 'from-orange-500 to-amber-500' },
  ];

  return (
    <section className="py-16 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div
              key={index}
              className={`text-center transform transition-all duration-700 ${
                isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/30 transition-colors">
                <div className="text-4xl sm:text-5xl font-bold text-white mb-2">
                  {stat.value}
                </div>
                <div className="text-white/90 font-medium text-lg">
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
