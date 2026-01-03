'use client';

import { useState } from 'react';
import Image from 'next/image';
import DownloadButtons from './DownloadButtons';
import { useCityCount, formatCityCount } from '@/lib/CityCountContext';

const activityBadges = [
  { name: 'Swimming', emoji: '🏊', color: 'bg-sky-100 text-sky-700', position: '-right-4 top-1/4' },
  { name: 'Sports', emoji: '⚽', color: 'bg-green-100 text-green-700', position: '-left-4 top-1/2' },
  { name: 'Arts', emoji: '🎨', color: 'bg-orange-100 text-orange-700', position: '-right-4 bottom-1/3' },
  { name: 'Music', emoji: '🎵', color: 'bg-yellow-100 text-yellow-700', position: '-left-4 bottom-1/4' },
];

export default function Hero() {
  const cityCount = useCityCount();
  const displayCount = formatCityCount(cityCount);
  const [imageError, setImageError] = useState(false);

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#FFF5F8] via-white to-[#E8F4FF] py-20 lg:py-28 bg-dots">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#FFB5C5] rounded-full opacity-30 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#E8638B] rounded-full opacity-20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#FFE5EC] rounded-full opacity-30 blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text Content */}
          <div className="text-center lg:text-left">
            {/* Canadian Badge */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mb-6">
              <div className="inline-flex items-center px-4 py-2 bg-pink-100 rounded-full text-[#E8638B] font-medium text-sm">
                <span className="mr-2">🎉</span>
                Now available in {displayCount} Canadian cities
              </div>
              <div className="inline-flex items-center px-3 py-2 bg-red-50 border border-red-200 rounded-full text-red-700 font-medium text-sm">
                <svg className="w-4 h-4 mr-1.5 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L9.5 8.5L3 9.5L7.5 14L6.5 21L12 17.5L17.5 21L16.5 14L21 9.5L14.5 8.5L12 2Z"/>
                </svg>
                Made in Canada
              </div>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
              AI-Powered{' '}
              <span className="gradient-text">Activity Discovery</span>{' '}
              for Your Kids
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-xl mx-auto lg:mx-0">
              Search naturally and see exactly why activities are great for your child's development.
              Our AI explains how each activity builds confidence, coordination, and social skills
              for your family.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <DownloadButtons />
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#E8638B]" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
                  </svg>
                </div>
                <span>AI-Powered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-rose-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                  </svg>
                </div>
                <span>Child Benefits</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <span>Waitlist Alerts</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                </div>
                <span>{displayCount} Cities</span>
              </div>
            </div>
          </div>

          {/* App Preview */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative">
              {/* Phone mockup */}
              <div className="relative w-64 sm:w-72 mx-auto">
                <div className="bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
                  <div className="bg-gray-100 rounded-[2.5rem] overflow-hidden aspect-[9/19]">
                    {/* App screenshot */}
                    <div className="w-full h-full bg-gradient-to-br from-[#FFE5EC] to-[#FFF5F8] relative">
                      {!imageError && (
                        <Image
                          src="/images/screenshots/dashboard.png"
                          alt="Kids Activity Tracker App"
                          fill
                          className="object-cover"
                          onError={() => setImageError(true)}
                        />
                      )}
                      {/* Fallback content - only show if image fails */}
                      {imageError && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center p-6">
                            <Image
                              src="/images/illustrations/app-logo.png"
                              alt="App Logo"
                              width={80}
                              height={80}
                              className="mx-auto mb-4"
                            />
                            <p className="text-[#C53078] font-medium">Kids Activity Tracker</p>
                            <p className="text-gray-500 text-sm mt-2">Find activities near you</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Floating activity badges */}
                {activityBadges.map((badge, index) => (
                  <div
                    key={badge.name}
                    className={`absolute ${badge.position} ${
                      index % 2 === 0 ? 'animate-float' : 'animate-float-delayed'
                    } bg-white rounded-xl shadow-lg p-3 flex items-center gap-2`}
                  >
                    <div className={`w-8 h-8 ${badge.color} rounded-full flex items-center justify-center`}>
                      <span className="text-lg">{badge.emoji}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-700">{badge.name}</span>
                  </div>
                ))}
              </div>

              {/* Decorative dots */}
              <div className="absolute -z-10 top-10 -left-20 w-40 h-40 grid grid-cols-5 gap-2 opacity-30">
                {Array.from({ length: 25 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: ['#E8638B', '#FFB5C5', '#FFD166', '#7C9EF5', '#22c55e'][i % 5],
                    }}
                  />
                ))}
              </div>
              <div className="absolute -z-10 bottom-10 -right-16 w-32 h-32 grid grid-cols-4 gap-2 opacity-30">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: ['#FFB5C5', '#FFD166', '#22c55e', '#E8638B'][i % 4],
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
