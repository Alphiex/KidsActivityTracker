'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import StatusIndicator, { StatusBadge } from '@/components/admin/monitoring/StatusIndicator';
import MetricCard from '@/components/admin/monitoring/MetricCard';
import RefreshControl from '@/components/admin/monitoring/RefreshControl';
import {
  getSystemHealth,
  getScraperStats,
  getAIMetrics,
  getUnreadNotificationCount,
  HealthStatus,
  ScraperStats,
  AIMetrics,
} from '@/lib/adminApi';

export default function MonitoringDashboard() {
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [scraperStats, setScraperStats] = useState<ScraperStats | null>(null);
  const [aiMetrics, setAIMetrics] = useState<AIMetrics | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [healthData, scraperData, aiData, notifData] = await Promise.allSettled([
        getSystemHealth(),
        getScraperStats(),
        getAIMetrics(),
        getUnreadNotificationCount(),
      ]);

      if (healthData.status === 'fulfilled') setHealth(healthData.value);
      if (scraperData.status === 'fulfilled') setScraperStats(scraperData.value);
      if (aiData.status === 'fulfilled') setAIMetrics(aiData.value);
      if (notifData.status === 'fulfilled') setUnreadCount(notifData.value.count);

      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getOverallStatus = () => {
    if (!health) return 'inactive';
    if (health.database.status === 'unhealthy' || health.ai.status === 'unhealthy') return 'error';
    if (health.database.status === 'degraded' || health.redis.status === 'unhealthy') return 'warning';
    return 'healthy';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Monitoring</h1>
          <p className="text-gray-500 mt-1">Overview of system health, scrapers, and AI usage</p>
        </div>
        <RefreshControl
          onRefresh={fetchData}
          isLoading={loading}
          lastUpdated={lastUpdated}
          autoRefreshInterval={30}
        />
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Quick navigation cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* System Health Card */}
        <Link
          href="/admin/monitoring/system"
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow min-w-0"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">System Health</h2>
            <StatusIndicator status={getOverallStatus()} showPulse />
          </div>
          {health && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Database</span>
                <StatusBadge status={health.database.status as any} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Redis</span>
                <StatusBadge status={health.redis.status as any} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">AI Service</span>
                <StatusBadge status={health.ai.status as any} />
              </div>
              <div className="pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-400">
                  Uptime: {health.uptime.formatted}
                </span>
              </div>
            </div>
          )}
          {loading && !health && (
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          )}
        </Link>

        {/* Scrapers Card */}
        <Link
          href="/admin/monitoring/scrapers"
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow min-w-0"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Scrapers</h2>
            {scraperStats && scraperStats.alerts.length > 0 && (
              <span className="bg-red-100 text-red-700 text-xs font-medium px-2 py-1 rounded-full">
                {scraperStats.alerts.length} alerts
              </span>
            )}
          </div>
          {scraperStats && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {scraperStats.summary.activeProviders}
                  </p>
                  <p className="text-xs text-gray-500">Active Providers</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {scraperStats.summary.totalActivities.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Total Activities</p>
                </div>
              </div>
              <div className="pt-2 border-t border-gray-100">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Success Rate</span>
                  <span className="text-sm font-medium text-green-600">
                    {(scraperStats.summary.successRate * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}
          {loading && !scraperStats && (
            <div className="animate-pulse space-y-3">
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          )}
        </Link>

        {/* AI Metrics Card */}
        <Link
          href="/admin/monitoring/ai"
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow min-w-0"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">AI Usage</h2>
            {aiMetrics?.budget.exceeded && (
              <span className="bg-red-100 text-red-700 text-xs font-medium px-2 py-1 rounded-full">
                Budget Exceeded
              </span>
            )}
          </div>
          {aiMetrics && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {aiMetrics.today.requests}
                  </p>
                  <p className="text-xs text-gray-500">Requests Today</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    ${aiMetrics.today.cost_usd.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">Cost Today</p>
                </div>
              </div>
              <div className="pt-2 border-t border-gray-100">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Daily Budget</span>
                  <span className="text-sm font-medium">
                    ${aiMetrics.budget.remaining_usd.toFixed(2)} remaining
                  </span>
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      aiMetrics.budget.exceeded ? 'bg-red-500' : 'bg-purple-600'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (aiMetrics.budget.spent_today_usd / aiMetrics.budget.daily_limit_usd) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
          {loading && !aiMetrics && (
            <div className="animate-pulse space-y-3">
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          )}
        </Link>
      </div>

      {/* Recent Alerts */}
      {scraperStats && scraperStats.alerts.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Alerts</h2>
          <div className="space-y-3">
            {scraperStats.alerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border ${
                  alert.severity === 'critical'
                    ? 'bg-red-50 border-red-200'
                    : alert.severity === 'warning'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{alert.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(alert.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <StatusBadge status={alert.severity as any} label={alert.type} />
                </div>
              </div>
            ))}
          </div>
          {scraperStats.alerts.length > 5 && (
            <Link
              href="/admin/monitoring/scrapers"
              className="block text-center text-sm text-purple-600 hover:text-purple-700 mt-4"
            >
              View all {scraperStats.alerts.length} alerts
            </Link>
          )}
        </div>
      )}

      {/* Recent Scraper Runs */}
      {scraperStats && scraperStats.recentRuns.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Scraper Runs</h2>
            <Link
              href="/admin/monitoring/scrapers"
              className="text-sm text-purple-600 hover:text-purple-700"
            >
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Provider
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Activities
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {scraperStats.recentRuns.slice(0, 5).map((run) => (
                  <tr key={run.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">{run.providerName}</td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={run.status === 'completed' ? 'healthy' : run.status === 'failed' ? 'error' : 'warning'}
                        label={run.status}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{run.activitiesFound}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {(run.executionTimeMs / 1000).toFixed(1)}s
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(run.startTime).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
