'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

interface ActivityData {
  id: string;
  name: string;
  organization?: string;
  category?: string;
  subcategory?: string;
  description?: string;
  cost?: number;
  ageRange?: {
    min: number;
    max: number;
  };
  location?: {
    address?: string;
    city?: string;
    name?: string;
  };
  locationName?: string;
  startTime?: string;
  endTime?: string;
  daysOfWeek?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  registrationStatus?: string;
  spotsAvailable?: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.kidsactivitytracker.ca';
const ID_REGEX = /^[a-zA-Z0-9_-]+$/;

// Validate ID format for security
function isValidId(id: string): boolean {
  return ID_REGEX.test(id) && id.length > 0 && id.length <= 128;
}

// Format price
function formatPrice(cost?: number): string {
  if (cost === undefined || cost === null) return 'Price varies';
  if (cost === 0) return 'Free';
  return `$${cost.toFixed(2)}`;
}

// Format time to 12-hour format
function formatTime(time?: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Format date range
function formatDateRange(dateRange?: { start: string; end: string }): string {
  if (!dateRange) return '';
  try {
    const startDate = new Date(dateRange.start).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const endDate = new Date(dateRange.end).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    return `${startDate} - ${endDate}`;
  } catch {
    return '';
  }
}

export default function ActivityPage({ params }: { params: { id: string } }) {
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Validate ID format
  const isIdValid = useMemo(() => isValidId(params.id), [params.id]);

  useEffect(() => {
    const fetchActivity = async () => {
      // Validate ID format before making request
      if (!isIdValid) {
        setError('Invalid activity link');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/api/activities/${encodeURIComponent(params.id)}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            setError('Activity not found');
          } else {
            setError('Failed to load activity');
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setActivity(data);
      } catch (err) {
        console.error('Error fetching activity:', err);
        setError('Failed to load activity');
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, [params.id, isIdValid]);

  const appStoreUrl = 'https://apps.apple.com/app/kids-activity-tracker/id6478181275';
  const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.kidsactivitytracker.app';
  // Only generate deep link if ID is valid
  const deepLink = isIdValid ? `kidsactivitytracker://activity/${encodeURIComponent(params.id)}` : '#';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF385C] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading activity...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Oops!</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <p className="text-gray-500 text-sm mb-6">This activity may have been removed or is no longer available.</p>
          <Link
            href="/"
            className="inline-block bg-[#FF385C] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#E31C5F] transition"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    );
  }

  // Get location string
  const locationStr = activity?.location?.name || activity?.locationName ||
    (activity?.location?.city ? activity.location.city : '');

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-2xl font-bold text-[#FF385C]">Kids Activity Tracker</h1>
          </Link>
        </div>

        {/* Activity Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Banner */}
          <div className="bg-gradient-to-r from-[#FF385C] to-[#E31C5F] py-6 px-8 text-white">
            <p className="text-sm opacity-80 mb-1">Shared Activity</p>
            <h2 className="text-xl font-semibold">{activity?.name}</h2>
            {activity?.organization && (
              <p className="text-sm opacity-90 mt-1">by {activity.organization}</p>
            )}
          </div>

          <div className="p-6">
            {/* Category */}
            {(activity?.category || activity?.subcategory) && (
              <div className="mb-4">
                <span className="inline-block bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                  {activity.category}{activity.subcategory ? ` - ${activity.subcategory}` : ''}
                </span>
              </div>
            )}

            {/* Description */}
            {activity?.description && (
              <p className="text-gray-600 mb-6 line-clamp-3">{activity.description}</p>
            )}

            {/* Details Grid */}
            <div className="space-y-4 mb-6">
              {/* Price */}
              <div className="flex items-center">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Price</p>
                  <p className="font-semibold text-gray-900">{formatPrice(activity?.cost)}</p>
                </div>
              </div>

              {/* Age Range */}
              {activity?.ageRange && (
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Ages</p>
                    <p className="font-semibold text-gray-900">{activity.ageRange.min} - {activity.ageRange.max} years</p>
                  </div>
                </div>
              )}

              {/* Location */}
              {locationStr && (
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="font-semibold text-gray-900">{locationStr}</p>
                  </div>
                </div>
              )}

              {/* Schedule */}
              {(activity?.startTime || activity?.daysOfWeek) && (
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Schedule</p>
                    <p className="font-semibold text-gray-900">
                      {activity.daysOfWeek && activity.daysOfWeek.length > 0 && (
                        <span>{activity.daysOfWeek.map(d => d.substring(0, 3)).join(', ')}</span>
                      )}
                      {activity.startTime && (
                        <span>
                          {activity.daysOfWeek && activity.daysOfWeek.length > 0 ? ' at ' : ''}
                          {formatTime(activity.startTime)}
                          {activity.endTime && ` - ${formatTime(activity.endTime)}`}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Date Range */}
              {activity?.dateRange && (
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Dates</p>
                    <p className="font-semibold text-gray-900">{formatDateRange(activity.dateRange)}</p>
                  </div>
                </div>
              )}

              {/* Registration Status */}
              {activity?.registrationStatus && (
                <div className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                    activity.registrationStatus.toLowerCase() === 'open' ? 'bg-green-100' : 'bg-yellow-100'
                  }`}>
                    <svg className={`w-5 h-5 ${
                      activity.registrationStatus.toLowerCase() === 'open' ? 'text-green-600' : 'text-yellow-600'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Registration</p>
                    <p className="font-semibold text-gray-900">
                      {activity.registrationStatus}
                      {activity.spotsAvailable !== undefined && ` (${activity.spotsAvailable} spots left)`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* CTA - Open in App */}
            <a
              href={deepLink}
              className="block w-full bg-[#FF385C] text-white text-center py-4 rounded-xl font-semibold text-lg hover:bg-[#E31C5F] transition mb-4"
            >
              View in App
            </a>

            {/* Download Links */}
            <p className="text-center text-gray-500 mb-4">Don&apos;t have the app yet?</p>
            <div className="flex gap-4">
              <a
                href={appStoreUrl}
                className="flex-1 flex items-center justify-center bg-black text-white py-3 px-4 rounded-xl hover:bg-gray-800 transition"
              >
                <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                App Store
              </a>
              <a
                href={playStoreUrl}
                className="flex-1 flex items-center justify-center bg-black text-white py-3 px-4 rounded-xl hover:bg-gray-800 transition"
              >
                <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                </svg>
                Google Play
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>Kids Activity Tracker helps families discover and coordinate children&apos;s activities.</p>
          <div className="mt-2">
            <Link href="/privacy" className="hover:text-[#FF385C]">Privacy Policy</Link>
            <span className="mx-2">&bull;</span>
            <Link href="/" className="hover:text-[#FF385C]">Learn More</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
