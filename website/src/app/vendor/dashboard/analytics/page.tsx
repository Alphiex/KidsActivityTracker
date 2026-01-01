'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getProfile } from '@/lib/vendorApi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.kidsactivitytracker.ca';

interface AnalyticsData {
  period: { start: string; end: string };
  totals: { impressions: number; clicks: number; ctr: string };
  timeSeries: Array<{ date: string; impressionsTotal: number; clicksTotal: number }>;
}

export default function AnalyticsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    checkSubscription();
  }, []);

  useEffect(() => {
    if (isSubscribed) {
      fetchAnalytics();
    }
  }, [isSubscribed, dateRange]);

  const checkSubscription = async () => {
    try {
      const response = await getProfile();
      if (response.success && response.vendor) {
        setIsSubscribed(response.vendor.subscriptionStatus === 'active');
      }
    } catch (err) {
      console.error('Failed to check subscription');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('vendor_token');
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const response = await fetch(
        `${API_URL}/api/vendor/analytics?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      const data = await response.json();
      if (data.success) {
        setAnalytics(data.analytics);
      }
    } catch (err) {
      console.error('Failed to fetch analytics');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Show upgrade prompt for non-subscribers
  if (!isSubscribed) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">Track your activity performance and engagement</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Blurred preview */}
          <div className="relative">
            <div className="filter blur-sm pointer-events-none p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-purple-50 rounded-xl p-6">
                  <div className="text-sm text-purple-600 mb-1">Impressions</div>
                  <div className="text-3xl font-bold text-purple-700">12,458</div>
                </div>
                <div className="bg-pink-50 rounded-xl p-6">
                  <div className="text-sm text-pink-600 mb-1">Clicks</div>
                  <div className="text-3xl font-bold text-pink-700">843</div>
                </div>
                <div className="bg-green-50 rounded-xl p-6">
                  <div className="text-sm text-green-600 mb-1">Click Rate</div>
                  <div className="text-3xl font-bold text-green-700">6.8%</div>
                </div>
              </div>
              <div className="h-64 bg-gray-100 rounded-xl"></div>
            </div>

            {/* Upgrade overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <div className="text-center max-w-md mx-auto p-8">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Unlock Analytics</h2>
                <p className="text-gray-600 mb-6">
                  Upgrade to a sponsor plan to access detailed analytics including impressions,
                  clicks, engagement trends, and activity performance.
                </p>
                <Link
                  href="/vendor/dashboard/plans"
                  className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
                >
                  View Upgrade Options
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show analytics for subscribers
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">Track your activity performance and engagement</p>
        </div>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === range
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Impressions</p>
              <p className="text-3xl font-bold text-gray-900">{analytics?.totals.impressions.toLocaleString() || 0}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Clicks</p>
              <p className="text-3xl font-bold text-gray-900">{analytics?.totals.clicks.toLocaleString() || 0}</p>
            </div>
            <div className="p-3 bg-pink-100 rounded-full">
              <svg className="w-6 h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Click-Through Rate</p>
              <p className="text-3xl font-bold text-gray-900">{analytics?.totals.ctr || '0%'}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Trend</h2>
        {analytics?.timeSeries && analytics.timeSeries.length > 0 ? (
          <div className="h-64 flex items-end justify-around gap-1">
            {analytics.timeSeries.map((day, i) => {
              const maxImpressions = Math.max(...analytics.timeSeries.map(d => d.impressionsTotal));
              const height = maxImpressions > 0 ? (day.impressionsTotal / maxImpressions) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-gradient-to-t from-purple-500 to-pink-400 rounded-t transition-all hover:opacity-80"
                    style={{ height: `${height}%`, minHeight: day.impressionsTotal > 0 ? '4px' : '0' }}
                    title={`${day.date}: ${day.impressionsTotal} impressions, ${day.clicksTotal} clicks`}
                  ></div>
                  {i % Math.ceil(analytics.timeSeries.length / 7) === 0 && (
                    <span className="text-xs text-gray-400 mt-2">{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">
            No data available for this period
          </div>
        )}
      </div>

      {/* Additional info */}
      <div className="bg-purple-50 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-medium text-purple-900">Understanding Your Analytics</h3>
            <p className="text-sm text-purple-700 mt-1">
              <strong>Impressions</strong> are counted when your activity appears in search results or browse pages.
              <strong> Clicks</strong> are tracked when a parent taps on your activity to view details.
              A higher <strong>CTR</strong> indicates your activity titles and descriptions are engaging.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
