/**
 * Vendor Portal API Client
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://kids-activity-api-205843686007.us-central1.run.app';

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

async function fetchWithAuth(endpoint: string, options: FetchOptions = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('vendor_token') : null;
  const vendorId = typeof window !== 'undefined' ? localStorage.getItem('vendor_id') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token && !options.skipAuth) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Replace :vendorId placeholder in endpoint
  const url = vendorId ? endpoint.replace(':vendorId', vendorId) : endpoint;

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('vendor_token');
      localStorage.removeItem('vendor_id');
      localStorage.removeItem('vendor_name');
      window.location.href = '/vendor/login';
      throw new Error('Session expired. Please log in again.');
    }
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || error.error || 'Request failed');
  }

  return response.json();
}

// ==================== Auth ====================

export async function login(email: string, password: string) {
  const response = await fetch(`${API_BASE}/api/vendor/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Login failed' }));
    throw new Error(error.message || error.error || 'Login failed');
  }

  return response.json();
}

export async function register(data: {
  email: string;
  password: string;
  name: string;
  organizationName: string;
  phone?: string;
  website?: string;
}) {
  const response = await fetch(`${API_BASE}/api/vendor/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Registration failed' }));
    throw new Error(error.message || error.error || 'Registration failed');
  }

  return response.json();
}

export async function getProfile() {
  return fetchWithAuth('/api/vendor/:vendorId/profile');
}

// ==================== Activities ====================

export interface VendorActivity {
  id: string;
  externalId: string | null;
  name: string;
  category: string | null;
  subcategory: string | null;
  description: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  startTime: string | null;
  endTime: string | null;
  dayOfWeek: string[];
  cost: number | null;
  ageMin: number | null;
  ageMax: number | null;
  locationName: string | null;
  fullAddress: string | null;
  isActive: boolean;
  isFeatured: boolean;
  featuredTier: string | null;
  spotsAvailable: number | null;
  totalSpots: number | null;
  registrationStatus: string | null;
  lastImportedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityListResponse {
  success: boolean;
  activities: VendorActivity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getActivities(params?: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  isActive?: boolean;
}): Promise<ActivityListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.search) searchParams.set('search', params.search);
  if (params?.category) searchParams.set('category', params.category);
  if (params?.isActive !== undefined) searchParams.set('isActive', params.isActive.toString());

  const query = searchParams.toString();
  return fetchWithAuth(`/api/vendor/:vendorId/activities${query ? `?${query}` : ''}`);
}

export async function getActivity(id: string): Promise<{ success: boolean; activity: VendorActivity }> {
  return fetchWithAuth(`/api/vendor/:vendorId/activities/${id}`);
}

export async function updateActivity(id: string, data: Partial<VendorActivity>): Promise<{ success: boolean; activity: VendorActivity }> {
  return fetchWithAuth(`/api/vendor/:vendorId/activities/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteActivity(id: string): Promise<{ success: boolean; message: string }> {
  return fetchWithAuth(`/api/vendor/:vendorId/activities/${id}`, {
    method: 'DELETE',
  });
}

export async function getActivityStats(): Promise<{
  success: boolean;
  stats: {
    total: number;
    active: number;
    inactive: number;
    featured: number;
    byCategory: { category: string; count: number }[];
  };
}> {
  return fetchWithAuth('/api/vendor/:vendorId/activities/stats/summary');
}

export async function bulkUpdateActivities(activityIds: string[], updates: Record<string, any>): Promise<{ success: boolean; updated: number }> {
  return fetchWithAuth('/api/vendor/:vendorId/activities/bulk-update', {
    method: 'POST',
    body: JSON.stringify({ activityIds, updates }),
  });
}

// ==================== Imports ====================

export interface ImportBatch {
  id: string;
  vendorId: string;
  fileName: string;
  fileType: string;
  status: 'PENDING' | 'VALIDATING' | 'VALIDATED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'AUTO_APPROVED';
  totalRows: number;
  validRows: number;
  errorRows: number;
  createdRows: number;
  updatedRows: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getImports(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<{ success: boolean; batches: ImportBatch[]; total: number; page: number; limit: number }> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.status) searchParams.set('status', params.status);

  const query = searchParams.toString();
  return fetchWithAuth(`/api/vendor/:vendorId/imports${query ? `?${query}` : ''}`);
}

export async function getImport(id: string): Promise<{ success: boolean } & ImportBatch> {
  return fetchWithAuth(`/api/vendor/:vendorId/imports/${id}`);
}

export async function previewFile(file: File): Promise<{
  success: boolean;
  fileType: string;
  stats: { totalRows: number; columns: number };
  headers: string[];
  suggestedMappings: Record<string, string>;
}> {
  const formData = new FormData();
  formData.append('file', file);

  const token = typeof window !== 'undefined' ? localStorage.getItem('vendor_token') : null;
  const vendorId = typeof window !== 'undefined' ? localStorage.getItem('vendor_id') : null;

  const response = await fetch(`${API_BASE}/api/vendor/${vendorId}/imports/preview-file`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Upload failed' }));
    throw new Error(error.message || error.error || 'Upload failed');
  }

  return response.json();
}

export async function uploadFile(file: File, fieldMapping?: Record<string, string>): Promise<{ success: boolean; batch: ImportBatch }> {
  const formData = new FormData();
  formData.append('file', file);
  if (fieldMapping) {
    formData.append('fieldMapping', JSON.stringify(fieldMapping));
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('vendor_token') : null;
  const vendorId = typeof window !== 'undefined' ? localStorage.getItem('vendor_id') : null;

  const response = await fetch(`${API_BASE}/api/vendor/${vendorId}/imports/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Upload failed' }));
    throw new Error(error.message || error.error || 'Upload failed');
  }

  return response.json();
}

export async function validateImport(id: string, fieldMapping: Record<string, string>): Promise<{ success: boolean; validation: any }> {
  return fetchWithAuth(`/api/vendor/:vendorId/imports/${id}/validate`, {
    method: 'POST',
    body: JSON.stringify({ fieldMapping }),
  });
}

export async function submitImport(id: string, notes?: string): Promise<{ success: boolean; batch: ImportBatch; message: string }> {
  return fetchWithAuth(`/api/vendor/:vendorId/imports/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export async function cancelImport(id: string): Promise<{ success: boolean; message: string }> {
  return fetchWithAuth(`/api/vendor/:vendorId/imports/${id}/cancel`, {
    method: 'POST',
  });
}

export async function getImportRows(id: string, params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<{ success: boolean; rows: any[]; total: number; page: number; limit: number }> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.status) searchParams.set('status', params.status);

  const query = searchParams.toString();
  return fetchWithAuth(`/api/vendor/:vendorId/imports/${id}/rows${query ? `?${query}` : ''}`);
}
