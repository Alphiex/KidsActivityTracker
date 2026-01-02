'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Activity {
  id: string;
  name: string;
  category: string;
  provider: {
    id: string;
    name: string;
  } | null;
  location: {
    id: string;
    name: string;
    city: string;
  } | null;
  activityType: {
    id: string;
    name: string;
  } | null;
  ageMin: number | null;
  ageMax: number | null;
  cost: number | null;
  isActive: boolean;
  isFeatured: boolean;
  featuredTier: string | null;
  manuallyEditedFields: string[];
  manuallyEditedAt: string | null;
  updatedAt: string;
  registrationStatus: string | null;
}

interface Provider {
  id: string;
  name: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function ActivitiesListPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [providerId, setProviderId] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [isActive, setIsActive] = useState('');
  const [isFeatured, setIsFeatured] = useState('');
  const [hasManualEdits, setHasManualEdits] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchProviders();
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [currentPage, providerId, city, category, isActive, isFeatured, hasManualEdits]);

  const fetchProviders = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/activities/providers`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      if (response.ok) {
        const result = await response.json();
        setProviders(result.providers || []);
      }
    } catch (err) {
      console.error('Error fetching providers:', err);
    }
  };

  const fetchActivities = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '25',
      });

      if (search) params.set('search', search);
      if (providerId) params.set('providerId', providerId);
      if (city) params.set('city', city);
      if (category) params.set('category', category);
      if (isActive) params.set('isActive', isActive);
      if (isFeatured) params.set('isFeatured', isFeatured);
      if (hasManualEdits) params.set('hasManualEdits', 'true');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/activities?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load activities');
      }

      const result = await response.json();
      setActivities(result.activities);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchActivities();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/activities/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete activity');
      }

      // Refresh the list
      fetchActivities();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
        Active
      </span>
    ) : (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
        Inactive
      </span>
    );
  };

  const getSponsorBadge = (tier: string | null) => {
    if (!tier) return null;
    const colors: Record<string, string> = {
      gold: 'bg-yellow-100 text-yellow-800',
      silver: 'bg-gray-200 text-gray-800',
      bronze: 'bg-orange-100 text-orange-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[tier] || 'bg-purple-100 text-purple-800'}`}>
        {tier}
      </span>
    );
  };

  const formatCost = (cost: number | null) => {
    if (cost === null) return '-';
    if (cost === 0) return 'Free';
    return `$${cost.toFixed(2)}`;
  };

  const formatAgeRange = (min: number | null, max: number | null) => {
    if (min === null && max === null) return '-';
    if (min === null) return `Up to ${max}`;
    if (max === null) return `${min}+`;
    if (min === max) return `${min} yrs`;
    return `${min}-${max} yrs`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Activities</h1>
        <Link
          href="/admin/activities/new"
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Add Activity
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, description, or external ID..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Search
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <select
              value={providerId}
              onChange={(e) => {
                setProviderId(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            >
              <option value="">All Providers</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onBlur={() => {
                setCurrentPage(1);
                fetchActivities();
              }}
              placeholder="City"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            />

            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              onBlur={() => {
                setCurrentPage(1);
                fetchActivities();
              }}
              placeholder="Category"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            />

            <select
              value={isActive}
              onChange={(e) => {
                setIsActive(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>

            <select
              value={isFeatured}
              onChange={(e) => {
                setIsFeatured(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            >
              <option value="">All Types</option>
              <option value="true">Sponsored Only</option>
              <option value="false">Non-Sponsored</option>
            </select>

            <label className="flex items-center gap-2 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={hasManualEdits}
                onChange={(e) => {
                  setHasManualEdits(e.target.checked);
                  setCurrentPage(1);
                }}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span>Manual Edits</span>
            </label>
          </div>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => setError('')}
            className="text-sm text-red-500 underline mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No activities found.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Activity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Provider
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Age
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cost
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activities.map((activity) => (
                    <tr key={activity.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="max-w-xs">
                          <div className="font-medium text-gray-900 truncate" title={activity.name}>
                            {activity.name}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">{activity.category}</span>
                            {activity.isFeatured && getSponsorBadge(activity.featuredTier)}
                            {activity.manuallyEditedFields.length > 0 && (
                              <span
                                className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800"
                                title={`Edited fields: ${activity.manuallyEditedFields.join(', ')}`}
                              >
                                Edited
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {activity.provider?.name || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {activity.location?.name || '-'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {activity.location?.city || ''}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {formatAgeRange(activity.ageMin, activity.ageMax)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {formatCost(activity.cost)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          {getStatusBadge(activity.isActive)}
                          {activity.registrationStatus && (
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              activity.registrationStatus === 'Closed'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {activity.registrationStatus}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/activities/${activity.id}`}
                            className="text-purple-600 hover:text-purple-900 text-sm"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(activity.id, activity.name)}
                            className="text-red-600 hover:text-red-900 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} activities
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 text-sm text-gray-600">
                    Page {currentPage} of {pagination.pages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === pagination.pages}
                    className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
