'use client';

import { useState, useEffect } from 'react';
import { sponsorApi } from '@/lib/sponsorApi';

interface AnalyticsData {
  period: { start: string; end: string };
  totals: {
    impressions: number;
    clicks: number;
    ctr: string;
  };
  timeSeries: Array<{
    date: string;
    impressionsTotal: number;
    clicksTotal: number;
  }>;
  breakdown: {
    byPlacement: {
      impressions: Array<{ placement: string; _count: number }>;
      clicks: Array<{ placement: string; _count: number }>;
    };
    byCity: {
      impressions: Array<{ city: string; _count: number }>;
      clicks: Array<{ city: string; _count: number }>;
    };
  };
}

interface ActivityAnalytics {
  activityId: string;
  name: string;
  activityType: string | null;
  location: string | null;
  city: string | null;
  impressions: number;
  clicks: number;
  ctr: string;
}

type DateRange = '7d' | '30d' | '90d';

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [activityData, setActivityData] = useState<ActivityAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString();

      // Fetch both general analytics and activity-level analytics
      const [generalResult, activityResult] = await Promise.all([
        sponsorApi.getAnalytics(startDateStr),
        sponsorApi.getActivityAnalytics(startDateStr, undefined, 20)
      ]);

      if (generalResult.success) {
        setData(generalResult.analytics);
      }
      if (activityResult.success) {
        setActivityData(activityResult.activities);
      }
    } catch (err) {
      console.error('Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">
            Detailed performance metrics for your partnership
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as DateRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === range
                  ? 'bg-[#E8638B] text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-sm text-gray-500 mb-1">Total Impressions</p>
          <p className="text-3xl font-bold text-gray-900">
            {data?.totals.impressions.toLocaleString() || 0}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-sm text-gray-500 mb-1">Total Clicks</p>
          <p className="text-3xl font-bold text-gray-900">
            {data?.totals.clicks.toLocaleString() || 0}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-sm text-gray-500 mb-1">Click-Through Rate</p>
          <p className="text-3xl font-bold text-[#E8638B]">
            {data?.totals.ctr || '0.00'}%
          </p>
        </div>
      </div>

      {/* Time Series Chart */}
      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Performance</h2>
        <div className="h-48">
          {data?.timeSeries && data.timeSeries.length > 0 ? (
            <div className="flex items-end gap-1 h-full">
              {data.timeSeries.map((day, i) => {
                const maxImpressions = Math.max(...data.timeSeries.map(d => d.impressionsTotal), 1);
                const height = (day.impressionsTotal / maxImpressions) * 100;
                return (
                  <div
                    key={i}
                    className="flex-1 relative group"
                  >
                    <div
                      className="w-full bg-[#E8638B] hover:bg-[#E8638B] transition-colors rounded-t"
                      style={{ height: `${Math.max(height, 2)}%` }}
                    />
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      <br />
                      {day.impressionsTotal} impressions
                      <br />
                      {day.clicksTotal} clicks
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              No data for this period
            </div>
          )}
        </div>
      </div>

      {/* Breakdown Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Placement */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">By Placement</h2>
          {data?.breakdown.byPlacement.impressions && data.breakdown.byPlacement.impressions.length > 0 ? (
            <div className="space-y-3">
              {data.breakdown.byPlacement.impressions.map((item) => {
                const clicks = data.breakdown.byPlacement.clicks.find(
                  c => c.placement === item.placement
                )?._count || 0;
                const ctr = item._count > 0 ? ((clicks / item._count) * 100).toFixed(2) : '0.00';

                return (
                  <div key={item.placement} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 capitalize">
                        {item.placement.replace(/_/g, ' ')}
                      </p>
                      <p className="text-sm text-gray-500">
                        {item._count.toLocaleString()} impressions, {clicks.toLocaleString()} clicks
                      </p>
                    </div>
                    <span className="text-[#E8638B] font-medium">{ctr}%</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">No placement data</p>
          )}
        </div>

        {/* By City */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Cities</h2>
          {data?.breakdown.byCity.impressions && data.breakdown.byCity.impressions.length > 0 ? (
            <div className="space-y-3">
              {data.breakdown.byCity.impressions.slice(0, 10).map((item) => {
                const clicks = data.breakdown.byCity.clicks.find(
                  c => c.city === item.city
                )?._count || 0;

                return (
                  <div key={item.city} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.city || 'Unknown'}</p>
                      <p className="text-sm text-gray-500">
                        {item._count.toLocaleString()} impressions
                      </p>
                    </div>
                    <span className="text-gray-600">{clicks} clicks</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">No city data</p>
          )}
        </div>
      </div>

      {/* Activity Performance Table */}
      <div className="bg-white rounded-xl shadow p-6 mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity Performance</h2>
        <p className="text-gray-500 text-sm mb-4">
          See how each of your activities is performing with impressions, clicks, and click-through rates.
        </p>

        {activityData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Activity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Impressions
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Clicks
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CTR
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {activityData.map((activity) => (
                  <tr key={activity.activityId} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-900 truncate max-w-xs" title={activity.name}>
                        {activity.name}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-gray-600 capitalize">
                        {activity.activityType?.replace(/_/g, ' ') || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-gray-600 truncate max-w-xs">
                        {activity.location || activity.city || '-'}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-gray-900 font-medium">
                        {activity.impressions.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-gray-900 font-medium">
                        {activity.clicks.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className={`font-medium ${
                        parseFloat(activity.ctr) >= 2 ? 'text-green-600' :
                        parseFloat(activity.ctr) >= 1 ? 'text-yellow-600' :
                        'text-gray-600'
                      }`}>
                        {activity.ctr}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p>No activity data available for this period.</p>
            <p className="text-sm mt-1">Activity performance will appear once your activities receive impressions.</p>
          </div>
        )}
      </div>
    </div>
  );
}
