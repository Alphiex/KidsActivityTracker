'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import StatusIndicator, { StatusBadge } from '@/components/admin/monitoring/StatusIndicator';
import MetricCard from '@/components/admin/monitoring/MetricCard';
import RefreshControl from '@/components/admin/monitoring/RefreshControl';
import { getSystemHealth, HealthStatus } from '@/lib/adminApi';

export default function SystemHealthPage() {
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getSystemHealth();
      setHealth(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatBytes = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/monitoring"
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
            <p className="text-gray-500 mt-1">Database, Redis, and AI service status</p>
          </div>
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

      {/* Service Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Database Status */}
        <div className={`rounded-lg border p-6 ${
          health?.database.status === 'healthy' ? 'bg-green-50 border-green-200' :
          health?.database.status === 'degraded' ? 'bg-yellow-50 border-yellow-200' :
          'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Database</h3>
            </div>
            {health && <StatusIndicator status={health.database.status as any} showPulse />}
          </div>
          {health && (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <StatusBadge status={health.database.status as any} />
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Latency</span>
                <span className="text-sm font-medium">{health.database.latencyMs}ms</span>
              </div>
              {health.database.connectionCount !== undefined && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Connections</span>
                  <span className="text-sm font-medium">{health.database.connectionCount}</span>
                </div>
              )}
            </div>
          )}
          {loading && !health && (
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          )}
        </div>

        {/* Redis Status */}
        <div className={`rounded-lg border p-6 ${
          health?.redis.status === 'healthy' ? 'bg-green-50 border-green-200' :
          health?.redis.status === 'disabled' ? 'bg-gray-50 border-gray-200' :
          'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Redis Cache</h3>
            </div>
            {health && <StatusIndicator status={health.redis.status as any} showPulse />}
          </div>
          {health && (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <StatusBadge status={health.redis.status as any} />
              </div>
              {health.redis.latencyMs !== undefined && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Latency</span>
                  <span className="text-sm font-medium">{health.redis.latencyMs}ms</span>
                </div>
              )}
            </div>
          )}
          {loading && !health && (
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          )}
        </div>

        {/* AI Service Status */}
        <div className={`rounded-lg border p-6 ${
          health?.ai.status === 'healthy' ? 'bg-green-50 border-green-200' :
          health?.ai.status === 'disabled' ? 'bg-gray-50 border-gray-200' :
          'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">AI Service</h3>
            </div>
            {health && <StatusIndicator status={health.ai.status as any} showPulse />}
          </div>
          {health && (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <StatusBadge status={health.ai.status as any} />
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">API Key</span>
                <span className={`text-sm font-medium ${health.ai.apiKeyConfigured ? 'text-green-600' : 'text-red-600'}`}>
                  {health.ai.apiKeyConfigured ? 'Configured' : 'Not Set'}
                </span>
              </div>
              {health.ai.budgetStatus && (
                <>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Budget Remaining</span>
                    <span className={`text-sm font-medium ${health.ai.budgetStatus.exceeded ? 'text-red-600' : 'text-green-600'}`}>
                      ${health.ai.budgetStatus.remaining_usd.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${health.ai.budgetStatus.exceeded ? 'bg-red-500' : 'bg-green-500'}`}
                      style={{
                        width: `${Math.min(100, (health.ai.budgetStatus.spent_today_usd / health.ai.budgetStatus.daily_limit_usd) * 100)}%`,
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          )}
          {loading && !health && (
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          )}
        </div>
      </div>

      {/* System Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Uptime"
          value={health?.uptime.formatted || '-'}
          subtitle="Since last restart"
          loading={loading}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <MetricCard
          title="Heap Used"
          value={health ? formatBytes(health.memory.heapUsed) : '-'}
          subtitle={health ? `of ${formatBytes(health.memory.heapTotal)}` : ''}
          loading={loading}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          }
        />
        <MetricCard
          title="RSS Memory"
          value={health ? formatBytes(health.memory.rss) : '-'}
          subtitle="Resident set size"
          loading={loading}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
          }
        />
        <MetricCard
          title="External Memory"
          value={health ? formatBytes(health.memory.external) : '-'}
          subtitle="C++ objects"
          loading={loading}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
          }
        />
      </div>

      {/* Memory Usage Chart Placeholder */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Memory Usage</h2>
        {health && (
          <div className="h-8 bg-gray-100 rounded-lg overflow-hidden flex">
            <div
              className="bg-[#E8638B] flex items-center justify-center text-white text-xs"
              style={{ width: `${(health.memory.heapUsed / health.memory.rss) * 100}%` }}
            >
              Heap
            </div>
            <div
              className="bg-blue-500 flex items-center justify-center text-white text-xs"
              style={{ width: `${(health.memory.external / health.memory.rss) * 100}%` }}
            >
              External
            </div>
            <div className="flex-1 bg-gray-200" />
          </div>
        )}
        <div className="flex items-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-[#E8638B] rounded" />
            <span className="text-gray-600">Heap Used</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-blue-500 rounded" />
            <span className="text-gray-600">External</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-gray-200 rounded" />
            <span className="text-gray-600">Available</span>
          </div>
        </div>
      </div>

      {/* Last Check */}
      {health && (
        <div className="text-sm text-gray-400 text-center">
          Last check: {new Date(health.timestamp).toLocaleString()}
        </div>
      )}
    </div>
  );
}
