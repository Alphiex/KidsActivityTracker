'use client';

import { ReactNode } from 'react';
import { useCityCount, formatCityCount } from '@/lib/CityCountContext';

interface Feature {
  title: string;
  description: string;
  icon: ReactNode;
  color: string;
  bgColor: string;
}

function getFeatures(displayCount: string): Feature[] {
  return [
  {
    title: 'Find Activities',
    description: 'Browse swimming, sports, arts, music, and educational programs for kids of all ages.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    color: 'text-purple-600',
    bgColor: 'from-purple-500 to-purple-600',
  },
  {
    title: 'Filter by Age',
    description: "Find activities perfect for your child's age group, from toddlers to teens.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    color: 'text-sky-600',
    bgColor: 'from-sky-500 to-sky-600',
  },
  {
    title: 'Track Schedules',
    description: "Keep all your children's activities organized in one easy-to-use calendar.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    color: 'text-green-600',
    bgColor: 'from-green-500 to-green-600',
  },
  {
    title: 'Save Favorites',
    description: 'Bookmark activities you love and get notified about registration openings.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    color: 'text-pink-600',
    bgColor: 'from-pink-500 to-pink-600',
  },
  {
    title: 'Across Canada',
    description: `Find activities in ${displayCount} Canadian cities, from BC to Ontario and growing coast to coast.`,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
    color: 'text-red-600',
    bgColor: 'from-red-500 to-red-600',
  },
  {
    title: 'Free to Use',
    description: 'Our basic features are completely free. Upgrade for unlimited favorites and more.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
      </svg>
    ),
    color: 'text-amber-600',
    bgColor: 'from-amber-500 to-amber-600',
  },
  ];
}

export default function Features() {
  const cityCount = useCityCount();
  const displayCount = formatCityCount(cityCount);
  const features = getFeatures(displayCount);

  return (
    <section className="py-20 bg-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-100 rounded-full opacity-30 blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-100 rounded-full opacity-30 blur-3xl translate-y-1/2 -translate-x-1/2" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Everything Canadian Families Need to Find{' '}
            <span className="gradient-text">Great Activities</span>
          </h2>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            Our app makes it easy to discover, organize, and track activities
            for your children across Canadian cities from coast to coast.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className={`w-14 h-14 bg-gradient-to-br ${feature.bgColor} rounded-xl flex items-center justify-center text-white mb-5 group-hover:scale-110 transition-transform duration-300`}>
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
