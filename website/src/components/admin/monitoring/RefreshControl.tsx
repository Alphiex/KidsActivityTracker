'use client';

import { useState, useEffect, useCallback } from 'react';

interface RefreshControlProps {
  onRefresh: () => void;
  isLoading?: boolean;
  lastUpdated?: Date | null;
  autoRefreshInterval?: number; // in seconds, 0 to disable
}

export default function RefreshControl({
  onRefresh,
  isLoading = false,
  lastUpdated,
  autoRefreshInterval = 30,
}: RefreshControlProps) {
  const [autoRefresh, setAutoRefresh] = useState(autoRefreshInterval > 0);
  const [countdown, setCountdown] = useState(autoRefreshInterval);

  const handleRefresh = useCallback(() => {
    setCountdown(autoRefreshInterval);
    onRefresh();
  }, [autoRefreshInterval, onRefresh]);

  useEffect(() => {
    if (!autoRefresh || autoRefreshInterval <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleRefresh();
          return autoRefreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefresh, autoRefreshInterval, handleRefresh]);

  const formatLastUpdated = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return date.toLocaleTimeString();
  };

  return (
    <div className="flex items-center gap-4">
      {/* Auto-refresh toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <div className="relative">
          <input
            type="checkbox"
            className="sr-only"
            checked={autoRefresh}
            onChange={(e) => {
              setAutoRefresh(e.target.checked);
              if (e.target.checked) {
                setCountdown(autoRefreshInterval);
              }
            }}
          />
          <div
            className={`block w-10 h-6 rounded-full transition-colors ${
              autoRefresh ? 'bg-[#E8638B]' : 'bg-gray-300'
            }`}
          />
          <div
            className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
              autoRefresh ? 'translate-x-4' : ''
            }`}
          />
        </div>
        <span className="text-sm text-gray-600">
          Auto-refresh
          {autoRefresh && countdown > 0 && (
            <span className="text-gray-400 ml-1">({countdown}s)</span>
          )}
        </span>
      </label>

      {/* Manual refresh button */}
      <button
        onClick={handleRefresh}
        disabled={isLoading}
        className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
          isLoading
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <svg
          className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        Refresh
      </button>

      {/* Last updated */}
      {lastUpdated && (
        <span className="text-sm text-gray-400">
          Updated {formatLastUpdated(lastUpdated)}
        </span>
      )}
    </div>
  );
}
