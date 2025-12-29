/**
 * Admin Portal API Client
 * Handles all communication with the backend admin monitoring endpoints
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://kids-activity-api-205843686007.us-central1.run.app';

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

async function fetchWithAuth(endpoint: string, options: FetchOptions = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token && !options.skipAuth) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || error.error || 'Request failed');
  }

  return response.json();
}

// ==================== System Health ====================

export interface HealthStatus {
  database: {
    status: 'healthy' | 'unhealthy' | 'degraded';
    latencyMs: number;
    connectionCount?: number;
  };
  redis: {
    status: 'healthy' | 'unhealthy' | 'disabled';
    latencyMs?: number;
  };
  ai: {
    status: 'healthy' | 'unhealthy' | 'disabled';
    apiKeyConfigured: boolean;
    budgetStatus?: {
      remaining_usd: number;
      exceeded: boolean;
      daily_limit_usd: number;
      spent_today_usd: number;
    };
  };
  uptime: {
    seconds: number;
    formatted: string;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  timestamp: string;
}

export async function getSystemHealth(): Promise<HealthStatus> {
  return fetchWithAuth('/api/admin/monitoring/health');
}

// ==================== Scraper Stats ====================

export interface ScraperStats {
  summary: {
    totalProviders: number;
    activeProviders: number;
    totalActivities: number;
    avgExecutionTimeMs: number;
    successRate: number;
    lastRunTime: string | null;
  };
  byPlatform: {
    platform: string;
    providers: number;
    activities: number;
    avgExecutionTimeMs: number;
    successRate: number;
  }[];
  recentRuns: {
    id: string;
    providerId: string;
    providerName: string;
    status: string;
    startTime: string;
    endTime: string | null;
    activitiesFound: number;
    executionTimeMs: number;
    errorMessage: string | null;
  }[];
  alerts: {
    id: string;
    type: string;
    severity: string;
    title: string;
    message: string;
    createdAt: string;
  }[];
}

export async function getScraperStats(): Promise<ScraperStats> {
  return fetchWithAuth('/api/admin/monitoring/scrapers/stats');
}

export interface ScraperRun {
  id: string;
  providerId: string;
  providerName: string;
  status: string;
  startTime: string;
  endTime: string | null;
  activitiesFound: number;
  newActivities: number;
  updatedActivities: number;
  executionTimeMs: number;
  errorMessage: string | null;
}

export async function getScraperRuns(params?: {
  providerId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ runs: ScraperRun[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.providerId) searchParams.set('providerId', params.providerId);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());

  const query = searchParams.toString();
  return fetchWithAuth(`/api/admin/monitoring/scrapers/runs${query ? `?${query}` : ''}`);
}

export interface ProviderStatus {
  id: string;
  name: string;
  platform: string;
  isActive: boolean;
  lastRunTime: string | null;
  lastRunStatus: string | null;
  totalActivities: number;
  avgExecutionTimeMs: number;
  successRate: number;
  healthStatus: 'healthy' | 'warning' | 'error' | 'inactive';
}

export async function getProvidersList(): Promise<{ providers: ProviderStatus[] }> {
  return fetchWithAuth('/api/admin/monitoring/scrapers/providers');
}

export async function getProviderDetail(providerId: string): Promise<{
  provider: ProviderStatus;
  recentRuns: ScraperRun[];
  metrics: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    avgExecutionTimeMs: number;
    totalActivitiesScraped: number;
  };
}> {
  return fetchWithAuth(`/api/admin/monitoring/scrapers/providers/${providerId}`);
}

export async function acknowledgeAlert(alertId: string): Promise<{ success: boolean }> {
  return fetchWithAuth(`/api/admin/monitoring/scrapers/alerts/${alertId}/acknowledge`, {
    method: 'POST',
  });
}

// ==================== AI Metrics ====================

export interface AIMetrics {
  today: {
    requests: number;
    cost_usd: number;
    tokens_in: number;
    tokens_out: number;
    cache_hits: number;
    errors: number;
  };
  budget: {
    remaining_usd: number;
    exceeded: boolean;
    daily_limit_usd: number;
    spent_today_usd: number;
  };
  byModel: {
    model: string;
    requests: number;
    cost_usd: number;
    tokens_in: number;
    tokens_out: number;
  }[];
  byEndpoint: {
    endpoint: string;
    requests: number;
    cost_usd: number;
    avg_latency_ms: number;
  }[];
  recent: {
    id: string;
    requestId: string;
    userId: string | null;
    model: string;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    endpoint: string;
    latencyMs: number | null;
    success: boolean;
    createdAt: string;
  }[];
}

export async function getAIMetrics(): Promise<AIMetrics> {
  return fetchWithAuth('/api/admin/monitoring/ai/metrics');
}

export interface AIHistoryEntry {
  date: string;
  requests: number;
  cost_usd: number;
  tokens_in: number;
  tokens_out: number;
  errors: number;
}

export async function getAIHistory(days?: number): Promise<{ history: AIHistoryEntry[] }> {
  const params = days ? `?days=${days}` : '';
  return fetchWithAuth(`/api/admin/monitoring/ai/history${params}`);
}

export async function updateAIBudget(dailyLimitUsd: number): Promise<{ success: boolean }> {
  return fetchWithAuth('/api/admin/monitoring/ai/budget', {
    method: 'PUT',
    body: JSON.stringify({ dailyLimitUsd }),
  });
}

// ==================== Notifications ====================

export interface AdminNotification {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export async function getNotifications(params?: {
  unreadOnly?: boolean;
  limit?: number;
}): Promise<{ notifications: AdminNotification[]; unreadCount: number }> {
  const searchParams = new URLSearchParams();
  if (params?.unreadOnly) searchParams.set('unreadOnly', 'true');
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return fetchWithAuth(`/api/admin/notifications${query ? `?${query}` : ''}`);
}

export async function getUnreadNotificationCount(): Promise<{ count: number }> {
  return fetchWithAuth('/api/admin/notifications/unread-count');
}

export async function markNotificationAsRead(notificationId: string): Promise<{ success: boolean }> {
  return fetchWithAuth(`/api/admin/notifications/${notificationId}/read`, {
    method: 'POST',
  });
}

export async function markAllNotificationsAsRead(): Promise<{ success: boolean }> {
  return fetchWithAuth('/api/admin/notifications/mark-all-read', {
    method: 'POST',
  });
}
