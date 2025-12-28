'use client';

import { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';

interface DashboardData {
  totalSponsors: number;
  activeSponsors: number;
  last30Days: {
    impressions: number;
    clicks: number;
    ctr: string;
  };
  topSponsors: Array<{
    id: string;
    providerName: string;
    impressions: number;
    clicks: number;
  }>;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/sponsors/analytics/overview`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load dashboard');
      }

      const result = await response.json();
      setData(result.overview);
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
          onClick={fetchDashboard}
          className="mt-2 text-sm text-purple-600 hover:text-purple-700"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Sponsors"
          value={data?.totalSponsors || 0}
          icon="users"
        />
        <StatCard
          title="Active Sponsors"
          value={data?.activeSponsors || 0}
          icon="check"
          color="green"
        />
        <StatCard
          title="Impressions (30d)"
          value={formatNumber(data?.last30Days.impressions || 0)}
          icon="eye"
          color="blue"
        />
        <StatCard
          title="Clicks (30d)"
          value={formatNumber(data?.last30Days.clicks || 0)}
          icon="cursor"
          color="purple"
        />
      </div>

      {/* CTR Card */}
      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Click-Through Rate (Last 30 Days)
        </h2>
        <div className="flex items-center">
          <span className="text-4xl font-bold text-purple-600">
            {data?.last30Days.ctr || '0.00'}%
          </span>
          <span className="ml-4 text-gray-500">
            {data?.last30Days.clicks} clicks / {data?.last30Days.impressions} impressions
          </span>
        </div>
      </div>

      {/* Top Sponsors */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Top Sponsors</h2>
          <Link
            href="/admin/sponsors"
            className="text-sm text-purple-600 hover:text-purple-700"
          >
            View All
          </Link>
        </div>
        <div className="divide-y divide-gray-200">
          {data?.topSponsors && data.topSponsors.length > 0 ? (
            data.topSponsors.map((sponsor) => (
              <Link
                key={sponsor.id}
                href={`/admin/sponsors/${sponsor.id}`}
                className="flex items-center px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{sponsor.providerName}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {formatNumber(sponsor.impressions)} impressions
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatNumber(sponsor.clicks)} clicks
                  </p>
                </div>
              </Link>
            ))
          ) : (
            <div className="px-6 py-8 text-center text-gray-500">
              No sponsors yet.{' '}
              <Link href="/admin/sponsors" className="text-purple-600 hover:text-purple-700">
                Add one
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color = 'purple',
}: {
  title: string;
  value: string | number;
  icon: string;
  color?: 'purple' | 'green' | 'blue';
}) {
  const colorClasses = {
    purple: 'bg-purple-100 text-purple-600',
    green: 'bg-green-100 text-green-600',
    blue: 'bg-blue-100 text-blue-600',
  };

  const icons: Record<string, ReactNode> = {
    users: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    check: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    eye: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
    cursor: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
      </svg>
    ),
  };

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          {icons[icon]}
        </div>
        <div className="ml-4">
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}
