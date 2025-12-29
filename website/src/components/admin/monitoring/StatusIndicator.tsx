'use client';

import { ReactNode } from 'react';

type StatusType = 'healthy' | 'warning' | 'error' | 'inactive' | 'degraded' | 'unhealthy' | 'disabled';

interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
}

const statusColors: Record<StatusType, { bg: string; ring: string; text: string }> = {
  healthy: { bg: 'bg-green-500', ring: 'ring-green-500/30', text: 'text-green-700' },
  warning: { bg: 'bg-yellow-500', ring: 'ring-yellow-500/30', text: 'text-yellow-700' },
  error: { bg: 'bg-red-500', ring: 'ring-red-500/30', text: 'text-red-700' },
  inactive: { bg: 'bg-gray-400', ring: 'ring-gray-400/30', text: 'text-gray-600' },
  degraded: { bg: 'bg-orange-500', ring: 'ring-orange-500/30', text: 'text-orange-700' },
  unhealthy: { bg: 'bg-red-500', ring: 'ring-red-500/30', text: 'text-red-700' },
  disabled: { bg: 'bg-gray-400', ring: 'ring-gray-400/30', text: 'text-gray-600' },
};

const sizeClasses = {
  sm: 'h-2 w-2',
  md: 'h-3 w-3',
  lg: 'h-4 w-4',
};

export default function StatusIndicator({
  status,
  label,
  size = 'md',
  showPulse = true,
}: StatusIndicatorProps) {
  const colors = statusColors[status] || statusColors.inactive;
  const sizeClass = sizeClasses[size];

  return (
    <div className="flex items-center gap-2">
      <span className="relative flex">
        <span
          className={`${sizeClass} rounded-full ${colors.bg} ${
            showPulse && (status === 'healthy' || status === 'warning')
              ? 'animate-pulse'
              : ''
          }`}
        />
        {showPulse && status === 'healthy' && (
          <span
            className={`absolute inline-flex h-full w-full rounded-full ${colors.bg} opacity-75 animate-ping`}
            style={{ animationDuration: '2s' }}
          />
        )}
      </span>
      {label && (
        <span className={`text-sm font-medium ${colors.text}`}>
          {label}
        </span>
      )}
    </div>
  );
}

// Status badge variant for use in tables/cards
interface StatusBadgeProps {
  status: StatusType;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const colors = statusColors[status] || statusColors.inactive;
  const displayLabel = label || status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} bg-opacity-10 ${colors.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${colors.bg}`} />
      {displayLabel}
    </span>
  );
}
