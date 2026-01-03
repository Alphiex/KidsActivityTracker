'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getActivityStats, getImports, getProfile } from '@/lib/vendorApi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.kidsactivitytracker.ca';

interface Stats {
  total: number;
  active: number;
  inactive: number;
  featured: number;
  byCategory: { category: string; count: number }[];
}

interface RecentImport {
  id: string;
  fileName: string;
  status: string;
  totalRows: number;
  createdAt: string;
}

interface SubscriptionInfo {
  isSubscribed: boolean;
  planName: string | null;
  tier: string | null;
}

interface SponsorMetrics {
  impressions: number;
  clicks: number;
  ctr: string;
}

export default function VendorDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentImports, setRecentImports] = useState<RecentImport[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionInfo>({ isSubscribed: false, planName: null, tier: null });
  const [sponsorMetrics, setSponsorMetrics] = useState<SponsorMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsResponse, importsResponse, profileResponse] = await Promise.all([
        getActivityStats(),
        getImports({ limit: 5 }),
        getProfile(),
      ]);

      if (statsResponse.success) {
        setStats(statsResponse.stats);
      }
      if (importsResponse.success) {
        setRecentImports(importsResponse.batches || []);
      }
      if (profileResponse.success && profileResponse.vendor) {
        const isActive = profileResponse.vendor.subscriptionStatus === 'active';
        setSubscription({
          isSubscribed: isActive,
          planName: profileResponse.vendor.plan?.name || null,
          tier: profileResponse.vendor.plan?.tier || null,
        });

        // Fetch sponsor metrics if subscribed
        if (isActive) {
          try {
            const token = localStorage.getItem('vendor_token');
            const metricsResponse = await fetch(`${API_URL}/api/vendor/dashboard`, {
              headers: { 'Authorization': `Bearer ${token}` },
            });
            const metricsData = await metricsResponse.json();
            if (metricsData.success && metricsData.dashboard) {
              setSponsorMetrics(metricsData.dashboard.last30Days);
            }
          } catch (e) {
            console.error('Failed to fetch sponsor metrics');
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      COMPLETED: 'bg-green-100 text-green-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      VALIDATED: 'bg-yellow-100 text-yellow-800',
      PENDING: 'bg-gray-100 text-gray-800',
      FAILED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-500',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || colors.PENDING}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E8638B]"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome to your partner portal</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Subscription Banner */}
      {subscription.isSubscribed ? (
        <div className="bg-gradient-to-r from-[#E8638B] to-[#D53F8C] rounded-xl p-6 mb-6 text-white">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div>
                <p className="text-white/80 text-sm">Active Sponsor</p>
                <p className="text-xl font-bold">{subscription.planName} Plan</p>
              </div>
            </div>
            {sponsorMetrics && (
              <div className="flex gap-8">
                <div className="text-center">
                  <p className="text-2xl font-bold">{sponsorMetrics.impressions.toLocaleString()}</p>
                  <p className="text-sm text-white/80">Impressions (30d)</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{sponsorMetrics.clicks.toLocaleString()}</p>
                  <p className="text-sm text-white/80">Clicks (30d)</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{sponsorMetrics.ctr}</p>
                  <p className="text-sm text-white/80">CTR</p>
                </div>
              </div>
            )}
            <Link
              href="/vendor/dashboard/analytics"
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              View Analytics
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow p-6 mb-6 border-l-4 border-[#E8638B]">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-pink-100 rounded-lg">
                <svg className="w-6 h-6 text-[#E8638B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Boost Your Visibility</p>
                <p className="text-sm text-gray-500">Upgrade to a sponsor plan for priority placement and detailed analytics</p>
              </div>
            </div>
            <Link
              href="/vendor/dashboard/plans"
              className="px-4 py-2 bg-gradient-to-r from-[#E8638B] to-[#D53F8C] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              View Plans
            </Link>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-6 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Activities</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.total ?? 0}</p>
            </div>
            <div className="p-3 bg-pink-100 rounded-full">
              <svg className="w-6 h-6 text-[#E8638B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Active</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{stats?.active ?? 0}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Inactive</p>
              <p className="text-3xl font-bold text-gray-600 mt-1">{stats?.inactive ?? 0}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded-full">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Sponsored</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">{stats?.featured ?? 0}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              href="/vendor/dashboard/imports/new"
              className="flex items-center p-4 bg-pink-50 rounded-lg hover:bg-pink-100 transition-colors"
            >
              <div className="p-2 bg-gradient-to-r from-[#E8638B] to-[#D53F8C] rounded-lg">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="font-medium text-gray-900">Import Activities</p>
                <p className="text-sm text-gray-500">Upload CSV or Excel file</p>
              </div>
            </Link>
            <Link
              href="/vendor/dashboard/activities"
              className="flex items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              <div className="p-2 bg-green-600 rounded-lg">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="font-medium text-gray-900">Manage Activities</p>
                <p className="text-sm text-gray-500">View, edit, or deactivate activities</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Categories Breakdown */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Activities by Category</h2>
          {stats?.byCategory && stats.byCategory.length > 0 ? (
            <div className="space-y-3">
              {stats.byCategory.slice(0, 5).map((cat) => (
                <div key={cat.category} className="flex items-center justify-between">
                  <span className="text-gray-600 truncate">{cat.category || 'Uncategorized'}</span>
                  <span className="font-medium text-gray-900 ml-2">{cat.count}</span>
                </div>
              ))}
              {stats.byCategory.length > 5 && (
                <Link
                  href="/vendor/dashboard/activities"
                  className="text-sm text-[#E8638B] hover:text-[#D53F8C]"
                >
                  View all categories
                </Link>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No activities yet</p>
          )}
        </div>
      </div>

      {/* Recent Imports */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Imports</h2>
          <Link
            href="/vendor/dashboard/imports"
            className="text-sm text-[#E8638B] hover:text-[#D53F8C]"
          >
            View all
          </Link>
        </div>
        {recentImports.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">File</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rows</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentImports.map((imp) => (
                  <tr key={imp.id}>
                    <td className="px-4 py-3 text-sm text-gray-900 truncate max-w-[200px]">{imp.fileName}</td>
                    <td className="px-4 py-3">{getStatusBadge(imp.status)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{imp.totalRows}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(imp.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No imports yet</p>
            <Link
              href="/vendor/dashboard/imports/new"
              className="text-[#E8638B] hover:text-[#D53F8C] text-sm mt-2 inline-block"
            >
              Import your first file
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
