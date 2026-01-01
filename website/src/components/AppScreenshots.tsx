'use client';

import { useState } from 'react';
import Image from 'next/image';

interface Screenshot {
  id: string;
  title: string;
  description: string;
  image: string;
}

const screenshots: Screenshot[] = [
  {
    id: 'discover',
    title: 'Discover Activities',
    description: 'Browse personalized recommendations and trending activities for your kids',
    image: '/images/screenshots/dashboard.png',
  },
  {
    id: 'calendar',
    title: 'Track Schedules',
    description: 'Keep all your children\'s activities organized in one beautiful calendar',
    image: '/images/screenshots/calendar.png',
  },
  {
    id: 'map',
    title: 'Activity Map',
    description: 'Find activities near you with our interactive map view',
    image: '/images/screenshots/filters.png',
  },
  {
    id: 'details',
    title: 'Activity Details',
    description: 'View all the info you need and register with one tap',
    image: '/images/screenshots/activity-detail.png',
  },
];

export default function AppScreenshots() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  const handleImageError = (index: number) => {
    setImageErrors(prev => ({ ...prev, [index]: true }));
  };

  return (
    <section className="py-20 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            See the App{' '}
            <span className="gradient-text">in Action</span>
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            A beautiful, intuitive interface designed to help busy parents
            find activities quickly.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Phone Mockups */}
          <div className="relative flex justify-center">
            <div className="relative">
              {/* Main phone */}
              <div className="relative w-64 sm:w-72 mx-auto z-10">
                <div className="bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
                  <div className="bg-gray-100 rounded-[2.5rem] overflow-hidden aspect-[9/19]">
                    {/* Screenshot container */}
                    <div className="w-full h-full bg-gradient-to-br from-purple-100 to-pink-100 relative">
                      {!imageErrors[activeIndex] && screenshots[activeIndex].image && (
                        <Image
                          src={screenshots[activeIndex].image}
                          alt={screenshots[activeIndex].title}
                          fill
                          className="object-cover"
                          onError={() => handleImageError(activeIndex)}
                        />
                      )}
                      {/* Only show fallback if image failed to load */}
                      {imageErrors[activeIndex] && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center p-6">
                            <div className="w-16 h-16 mx-auto mb-4 bg-purple-200 rounded-2xl flex items-center justify-center">
                              <span className="text-3xl">
                                {activeIndex === 0 ? '🔍' : activeIndex === 1 ? '📅' : activeIndex === 2 ? '🗺️' : '📋'}
                              </span>
                            </div>
                            <p className="text-gray-600 font-medium">
                              {screenshots[activeIndex].title}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Decorative elements */}
              <div className="absolute -top-4 -left-4 w-24 h-24 bg-purple-200 rounded-full opacity-50 blur-2xl" />
              <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-pink-200 rounded-full opacity-50 blur-2xl" />
            </div>
          </div>

          {/* Feature list */}
          <div className="space-y-4">
            {screenshots.map((screenshot, index) => (
              <button
                key={screenshot.id}
                onClick={() => setActiveIndex(index)}
                className={`w-full text-left p-6 rounded-2xl transition-all duration-300 ${
                  index === activeIndex
                    ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 shadow-lg'
                    : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      index === activeIndex
                        ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    <span className="text-2xl">
                      {index === 0 ? '🔍' : index === 1 ? '📅' : index === 2 ? '🗺️' : '📋'}
                    </span>
                  </div>
                  <div>
                    <h3 className={`font-bold text-lg mb-1 ${
                      index === activeIndex ? 'text-purple-900' : 'text-gray-900'
                    }`}>
                      {screenshot.title}
                    </h3>
                    <p className="text-gray-600">{screenshot.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
