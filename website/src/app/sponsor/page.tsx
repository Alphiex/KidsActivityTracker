'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DashboardData {
  today: { impressions: number; clicks: number; ctr: string };
  last7Days: { impressions: number; clicks: number; ctr: string };
  last30Days: { impressions: number; clicks: number; ctr: string };
  dailyTrend: Array<{
    date: string;
    impressionsTotal: number;
    clicksTotal: number;
  }>;
  subscription: {
    plan: { name: string; tier: string } | null;
    status: string;
    endsAt: string | null;
  };
}

export default function SponsorDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const token = localStorage.getItem('sponsor_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/sponsor/dashboard`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error('Failed to load dashboard');

      const result = await response.json();
      setData(result.dashboard);
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
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Subscription Status */}
      {data?.subscription && (
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-xl shadow-lg p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-200 text-sm">Current Plan</p>
              <p className="text-2xl font-bold">
                {data.subscription.plan?.name || 'No Plan'}
              </p>
              <p className="text-purple-200 capitalize">
                {data.subscription.status}
                {data.subscription.endsAt && (
                  <> - Renews {new Date(data.subscription.endsAt).toLocaleDateString()}</>
                )}
              </p>
            </div>
            <Link
              href="/sponsor/plans"
              className="px-4 py-2 bg-white text-purple-700 rounded-lg font-medium hover:bg-purple-50 transition-colors"
            >
              Upgrade
            </Link>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Today"
          impressions={data?.today.impressions || 0}
          clicks={data?.today.clicks || 0}
          ctr={data?.today.ctr || '0.00'}
        />
        <StatCard
          title="Last 7 Days"
          impressions={data?.last7Days.impressions || 0}
          clicks={data?.last7Days.clicks || 0}
          ctr={data?.last7Days.ctr || '0.00'}
        />
        <StatCard
          title="Last 30 Days"
          impressions={data?.last30Days.impressions || 0}
          clicks={data?.last30Days.clicks || 0}
          ctr={data?.last30Days.ctr || '0.00'}
        />
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Performance Trend</h2>
          <Link
            href="/sponsor/analytics"
            className="text-sm text-purple-600 hover:text-purple-700"
          >
            View Details
          </Link>
        </div>

        {/* Simple bar chart */}
        <div className="mt-4">
          <div className="flex items-end gap-1 h-32">
            {data?.dailyTrend && data.dailyTrend.length > 0 ? (
              data.dailyTrend.map((day, i) => {
                const maxImpressions = Math.max(...data.dailyTrend.map(d => d.impressionsTotal), 1);
                const height = (day.impressionsTotal / maxImpressions) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-purple-500 hover:bg-purple-600 transition-colors rounded-t"
                      style={{ height: `${Math.max(height, 4)}%` }}
                      title={`${new Date(day.date).toLocaleDateString()}: ${day.impressionsTotal} impressions, ${day.clicksTotal} clicks`}
                    />
                    <p className="text-xs text-gray-400 mt-1 rotate-45 origin-left">
                      {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                No data yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <Link
          href="/sponsor/targeting"
          className="bg-white rounded-xl shadow p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="font-semibold text-gray-900">Geographic Targeting</h3>
              <p className="text-sm text-gray-500">Choose which cities and provinces to target</p>
            </div>
          </div>
        </Link>

        <Link
          href="/sponsor/billing"
          className="bg-white rounded-xl shadow p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="font-semibold text-gray-900">Billing & Invoices</h3>
              <p className="text-sm text-gray-500">View your payment history</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  title,
  impressions,
  clicks,
  ctr,
}: {
  title: string;
  impressions: number;
  clicks: number;
  ctr: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow p-6">
      <p className="text-sm font-medium text-gray-500 mb-3">{title}</p>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Impressions</span>
          <span className="font-semibold text-gray-900">{impressions.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Clicks</span>
          <span className="font-semibold text-gray-900">{clicks.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t">
          <span className="text-gray-600">CTR</span>
          <span className="font-bold text-purple-600">{ctr}%</span>
        </div>
      </div>
    </div>
  );
}
