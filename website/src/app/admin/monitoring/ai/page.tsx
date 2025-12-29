'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/admin/monitoring/StatusIndicator';
import MetricCard from '@/components/admin/monitoring/MetricCard';
import RefreshControl from '@/components/admin/monitoring/RefreshControl';
import {
  getAIMetrics,
  getAIHistory,
  updateAIBudget,
  AIMetrics,
  AIHistoryEntry,
} from '@/lib/adminApi';

export default function AIMetricsDashboard() {
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [metrics, setMetrics] = useState<AIMetrics | null>(null);
  const [history, setHistory] = useState<AIHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [newBudget, setNewBudget] = useState('10.00');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [metricsData, historyData] = await Promise.all([
        getAIMetrics(),
        getAIHistory(30),
      ]);

      setMetrics(metricsData);
      setHistory(historyData.history);
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

  const handleUpdateBudget = async () => {
    try {
      await updateAIBudget(parseFloat(newBudget));
      setShowBudgetModal(false);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update budget');
    }
  };

  const maxCost = Math.max(...history.map((h) => h.cost_usd), 0.01);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/monitoring" className="text-gray-500 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Metrics</h1>
            <p className="text-gray-500 mt-1">OpenAI usage, costs, and budget tracking</p>
          </div>
        </div>
        <RefreshControl
          onRefresh={fetchData}
          isLoading={loading}
          lastUpdated={lastUpdated}
          autoRefreshInterval={30}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
      )}

      {/* Budget Card */}
      {metrics && (
        <div className={`rounded-lg border p-6 ${
          metrics.budget.exceeded ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Daily Budget</h2>
              <p className="text-sm text-gray-500">
                ${metrics.budget.spent_today_usd.toFixed(2)} of ${metrics.budget.daily_limit_usd.toFixed(2)} used today
              </p>
            </div>
            <button
              onClick={() => {
                setNewBudget(metrics.budget.daily_limit_usd.toString());
                setShowBudgetModal(true);
              }}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Update Budget
            </button>
          </div>
          <div className="w-full bg-white rounded-full h-4 overflow-hidden">
            <div
              className={`h-4 rounded-full transition-all duration-500 ${
                metrics.budget.exceeded ? 'bg-red-500' : 'bg-green-500'
              }`}
              style={{
                width: `${Math.min(100, (metrics.budget.spent_today_usd / metrics.budget.daily_limit_usd) * 100)}%`,
              }}
            />
          </div>
          <div className="flex justify-between mt-2 text-sm">
            <span className={metrics.budget.exceeded ? 'text-red-600 font-medium' : 'text-green-600'}>
              ${metrics.budget.remaining_usd.toFixed(2)} remaining
            </span>
            <span className="text-gray-500">
              {((metrics.budget.spent_today_usd / metrics.budget.daily_limit_usd) * 100).toFixed(1)}% used
            </span>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Requests Today"
          value={metrics?.today.requests || 0}
          loading={loading}
          color="blue"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          }
        />
        <MetricCard
          title="Cost Today"
          value={metrics ? `$${metrics.today.cost_usd.toFixed(2)}` : '-'}
          loading={loading}
          color="green"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <MetricCard
          title="Tokens In"
          value={metrics?.today.tokens_in.toLocaleString() || '0'}
          loading={loading}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          }
        />
        <MetricCard
          title="Tokens Out"
          value={metrics?.today.tokens_out.toLocaleString() || '0'}
          loading={loading}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          }
        />
      </div>

      {/* Cost History Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cost History (Last 30 Days)</h2>
        <div className="h-48 flex items-end gap-1">
          {history.map((day, index) => (
            <div
              key={day.date}
              className="flex-1 group relative"
            >
              <div
                className="bg-purple-500 rounded-t hover:bg-purple-600 transition-colors cursor-pointer"
                style={{ height: `${(day.cost_usd / maxCost) * 100}%`, minHeight: day.cost_usd > 0 ? '4px' : '0' }}
              />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                  <div className="font-medium">{new Date(day.date).toLocaleDateString()}</div>
                  <div>${day.cost_usd.toFixed(4)}</div>
                  <div>{day.requests} requests</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-400">
          <span>{history.length > 0 ? new Date(history[0].date).toLocaleDateString() : ''}</span>
          <span>{history.length > 0 ? new Date(history[history.length - 1].date).toLocaleDateString() : ''}</span>
        </div>
      </div>

      {/* Usage by Model */}
      {metrics && metrics.byModel.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Usage by Model</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requests</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tokens In</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tokens Out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {metrics.byModel.map((model) => (
                  <tr key={model.model}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{model.model}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{model.requests}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">${model.cost_usd.toFixed(4)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{model.tokens_in.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{model.tokens_out.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Usage by Endpoint */}
      {metrics && metrics.byEndpoint.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Usage by Endpoint</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Endpoint</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requests</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {metrics.byEndpoint.map((endpoint) => (
                  <tr key={endpoint.endpoint}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{endpoint.endpoint}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{endpoint.requests}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">${endpoint.cost_usd.toFixed(4)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{endpoint.avg_latency_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Requests */}
      {metrics && metrics.recent.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Requests</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Endpoint</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tokens</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {metrics.recent.map((req) => (
                  <tr key={req.id} className={!req.success ? 'bg-red-50' : ''}>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(req.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{req.model}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{req.endpoint}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {req.tokensIn} / {req.tokensOut}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">${req.costUsd.toFixed(4)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={req.success ? 'healthy' : 'error'}
                        label={req.success ? 'Success' : 'Error'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Budget Update Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Update Daily Budget</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Daily Limit (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newBudget}
                  onChange={(e) => setNewBudget(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowBudgetModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateBudget}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
