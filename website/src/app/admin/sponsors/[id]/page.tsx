'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface SponsorDetail {
  id: string;
  provider: {
    id: string;
    name: string;
    website: string;
    contactInfo: any;
  };
  plan: {
    id: string;
    name: string;
    tier: string;
    monthlyPrice: string;
  } | null;
  subscriptionStatus: string;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  targetCities: string[];
  targetProvinces: string[];
  billingEmail: string;
  billingName: string | null;
  createdAt: string;
  analytics: {
    last30Days: {
      impressions: number;
      clicks: number;
      ctr: string;
    };
    daily: Array<{
      date: string;
      impressionsTotal: number;
      clicksTotal: number;
    }>;
  };
}

export default function SponsorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [sponsor, setSponsor] = useState<SponsorDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    subscriptionStatus: '',
    billingEmail: '',
    billingName: '',
    targetCities: [] as string[],
    targetProvinces: [] as string[],
  });

  useEffect(() => {
    fetchSponsor();
  }, [params.id]);

  const fetchSponsor = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/sponsors/${params.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load partner');
      }

      const result = await response.json();
      setSponsor(result.sponsor);
      setFormData({
        subscriptionStatus: result.sponsor.subscriptionStatus,
        billingEmail: result.sponsor.billingEmail,
        billingName: result.sponsor.billingName || '',
        targetCities: result.sponsor.targetCities,
        targetProvinces: result.sponsor.targetProvinces,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/sponsors/${params.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update sponsor');
      }

      setIsEditing(false);
      fetchSponsor();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error || !sponsor) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">{error || 'Partner not found'}</p>
        <Link href="/admin/sponsors" className="mt-2 text-purple-600 hover:text-purple-700">
          Back to Sponsored Partners
        </Link>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      past_due: 'bg-yellow-100 text-yellow-800',
      inactive: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`px-3 py-1 text-sm font-medium rounded-full ${colors[status] || colors.inactive}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/sponsors"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{sponsor.provider.name}</h1>
            <p className="text-gray-500">{sponsor.provider.website}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(sponsor.subscriptionStatus)}
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Analytics Card */}
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Last 30 Days</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">
                  {sponsor.analytics.last30Days.impressions.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">Impressions</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">
                  {sponsor.analytics.last30Days.clicks.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">Clicks</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">
                  {sponsor.analytics.last30Days.ctr}%
                </p>
                <p className="text-sm text-gray-500">CTR</p>
              </div>
            </div>

            {/* Simple bar chart */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Daily Impressions</h3>
              <div className="flex items-end gap-1 h-24">
                {sponsor.analytics.daily.map((day, i) => {
                  const maxImpressions = Math.max(...sponsor.analytics.daily.map(d => d.impressionsTotal), 1);
                  const height = (day.impressionsTotal / maxImpressions) * 100;
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-purple-200 hover:bg-purple-300 transition-colors rounded-t"
                      style={{ height: `${Math.max(height, 2)}%` }}
                      title={`${new Date(day.date).toLocaleDateString()}: ${day.impressionsTotal} impressions`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Targeting */}
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Geographic Targeting</h2>
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Cities (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.targetCities.join(', ')}
                    onChange={(e) => setFormData({
                      ...formData,
                      targetCities: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Vancouver, Surrey, Burnaby"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Provinces (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.targetProvinces.join(', ')}
                    onChange={(e) => setFormData({
                      ...formData,
                      targetProvinces: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="BC, AB, ON"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Cities</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {sponsor.targetCities.length > 0 ? (
                      sponsor.targetCities.map((city) => (
                        <span key={city} className="px-2 py-1 bg-gray-100 rounded text-sm">
                          {city}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400">All cities</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Provinces</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {sponsor.targetProvinces.length > 0 ? (
                      sponsor.targetProvinces.map((province) => (
                        <span key={province} className="px-2 py-1 bg-gray-100 rounded text-sm">
                          {province}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400">All provinces</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Plan */}
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscription</h2>
            {sponsor.plan ? (
              <div>
                <p className="text-xl font-bold text-gray-900">{sponsor.plan.name}</p>
                <p className="text-gray-500 capitalize">{sponsor.plan.tier} Tier</p>
                <p className="text-sm text-gray-500 mt-2">
                  ${sponsor.plan.monthlyPrice}/month
                </p>
              </div>
            ) : (
              <p className="text-gray-500">No plan assigned</p>
            )}

            {isEditing && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.subscriptionStatus}
                  onChange={(e) => setFormData({ ...formData, subscriptionStatus: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="past_due">Past Due</option>
                </select>
              </div>
            )}
          </div>

          {/* Billing */}
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Billing</h2>
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.billingEmail}
                    onChange={(e) => setFormData({ ...formData, billingEmail: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.billingName}
                    onChange={(e) => setFormData({ ...formData, billingName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="text-gray-500">Email:</span>{' '}
                  <span className="text-gray-900">{sponsor.billingEmail}</span>
                </p>
                <p className="text-sm">
                  <span className="text-gray-500">Name:</span>{' '}
                  <span className="text-gray-900">{sponsor.billingName || '-'}</span>
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          {isEditing && (
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Save
              </button>
            </div>
          )}

          {/* Dates */}
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Dates</h2>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-gray-500">Created:</span>{' '}
                <span className="text-gray-900">
                  {new Date(sponsor.createdAt).toLocaleDateString()}
                </span>
              </p>
              {sponsor.subscriptionStartDate && (
                <p>
                  <span className="text-gray-500">Subscription Start:</span>{' '}
                  <span className="text-gray-900">
                    {new Date(sponsor.subscriptionStartDate).toLocaleDateString()}
                  </span>
                </p>
              )}
              {sponsor.subscriptionEndDate && (
                <p>
                  <span className="text-gray-500">Subscription End:</span>{' '}
                  <span className="text-gray-900">
                    {new Date(sponsor.subscriptionEndDate).toLocaleDateString()}
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
