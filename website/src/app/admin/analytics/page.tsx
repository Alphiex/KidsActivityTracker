'use client';

import { useState, useEffect } from 'react';

interface AnalyticsOverview {
  totalPartners: number;
  activePartners: number;
  last30Days: {
    impressions: number;
    clicks: number;
    ctr: string;
  };
  topPartners: {
    id: string;
    providerName: string;
    impressions: number;
    clicks: number;
  }[];
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        window.location.href = '/admin/login';
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/partners/analytics/overview`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        localStorage.removeItem('admin_token');
        window.location.href = '/admin/login';
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load analytics');
      }

      const result = await response.json();
      setOverview(result.overview);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchAnalytics}
          className="mt-2 text-sm text-purple-600 hover:text-purple-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Analytics</h1>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-6 min-w-0">
          <div className="text-sm font-medium text-gray-500">Total Partners</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">
            {overview?.totalPartners ?? 0}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6 min-w-0">
          <div className="text-sm font-medium text-gray-500">Active Partners</div>
          <div className="text-3xl font-bold text-green-600 mt-2">
            {overview?.activePartners ?? 0}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6 min-w-0">
          <div className="text-sm font-medium text-gray-500">Impressions (30 days)</div>
          <div className="text-3xl font-bold text-blue-600 mt-2">
            {(overview?.last30Days.impressions ?? 0).toLocaleString()}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6 min-w-0">
          <div className="text-sm font-medium text-gray-500">Click-Through Rate</div>
          <div className="text-3xl font-bold text-purple-600 mt-2">
            {overview?.last30Days.ctr ?? '0.00'}%
          </div>
        </div>
      </div>

      {/* Clicks Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-6 min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Last 30 Days</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Impressions</span>
              <span className="font-semibold">
                {(overview?.last30Days.impressions ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Clicks</span>
              <span className="font-semibold">
                {(overview?.last30Days.clicks ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Click-Through Rate</span>
              <span className="font-semibold text-purple-600">
                {overview?.last30Days.ctr ?? '0.00'}%
              </span>
            </div>
          </div>
        </div>

        {/* Top Partners */}
        <div className="bg-white rounded-xl shadow p-6 min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Partners</h2>
          {overview?.topPartners && overview.topPartners.length > 0 ? (
            <div className="space-y-3">
              {overview.topPartners.map((partner, index) => (
                <div
                  key={partner.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </span>
                    <span className="font-medium text-gray-900">{partner.providerName}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {partner.impressions.toLocaleString()} views
                    </div>
                    <div className="text-xs text-gray-500">
                      {partner.clicks.toLocaleString()} clicks
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No partner data available yet
            </div>
          )}
        </div>
      </div>

      {/* Placeholder for future charts */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Trends</h2>
        <div className="h-64 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p>Chart visualization coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}
