'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Activity {
  id: string;
  name: string;
  externalId: string;
  description: string | null;
  fullDescription: string | null;
  category: string | null;
  subcategory: string | null;
  startTime: string | null;
  endTime: string | null;
  dayOfWeek: string[];
  dateStart: string | null;
  dateEnd: string | null;
  schedule: string | null;
  dates: string | null;
  locationId: string | null;
  locationName: string | null;
  fullAddress: string | null;
  registrationUrl: string | null;
  registrationStatus: string | null;
  registrationButtonText: string | null;
  registrationDate: string | null;
  registrationEndDate: string | null;
  spotsAvailable: number | null;
  totalSpots: number | null;
  cost: number | null;
  costIncludesTax: boolean | null;
  taxAmount: number | null;
  ageMin: number | null;
  ageMax: number | null;
  providerId: string;
  provider: { id: string; name: string; website: string | null } | null;
  location: { id: string; name: string; city: string; address: string } | null;
  activityTypeId: string | null;
  activityType: { id: string; name: string } | null;
  activitySubtypeId: string | null;
  activitySubtype: { id: string; name: string } | null;
  isFeatured: boolean;
  featuredTier: string | null;
  featuredStartDate: string | null;
  featuredEndDate: string | null;
  isActive: boolean;
  manuallyEditedFields: string[];
  manuallyEditedAt: string | null;
  manuallyEditedBy: string | null;
}

interface Provider {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
  city: string;
  address: string;
}

interface ActivityType {
  id: string;
  name: string;
  code: string;
  subtypes: { id: string; name: string; code: string }[];
}

export default function EditActivityPage() {
  const router = useRouter();
  const params = useParams();
  const activityId = params.id as string;

  const [activity, setActivity] = useState<Activity | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    fullDescription: '',
    category: '',
    subcategory: '',
    startTime: '',
    endTime: '',
    dayOfWeek: [] as string[],
    dateStart: '',
    dateEnd: '',
    schedule: '',
    dates: '',
    locationId: '',
    locationName: '',
    fullAddress: '',
    registrationUrl: '',
    registrationStatus: '',
    registrationButtonText: '',
    registrationDate: '',
    registrationEndDate: '',
    spotsAvailable: '',
    totalSpots: '',
    cost: '',
    costIncludesTax: false,
    taxAmount: '',
    ageMin: '',
    ageMax: '',
    activityTypeId: '',
    activitySubtypeId: '',
    isFeatured: false,
    featuredTier: '',
    featuredStartDate: '',
    featuredEndDate: '',
    isActive: true,
  });

  useEffect(() => {
    fetchActivity();
    fetchDropdownData();
  }, [activityId]);

  const fetchActivity = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/activities/${activityId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load activity');
      }

      const result = await response.json();
      const a = result.activity;
      setActivity(a);

      // Populate form data
      setFormData({
        name: a.name || '',
        description: a.description || '',
        fullDescription: a.fullDescription || '',
        category: a.category || '',
        subcategory: a.subcategory || '',
        startTime: a.startTime || '',
        endTime: a.endTime || '',
        dayOfWeek: a.dayOfWeek || [],
        dateStart: a.dateStart ? a.dateStart.split('T')[0] : '',
        dateEnd: a.dateEnd ? a.dateEnd.split('T')[0] : '',
        schedule: a.schedule || '',
        dates: a.dates || '',
        locationId: a.locationId || '',
        locationName: a.locationName || '',
        fullAddress: a.fullAddress || '',
        registrationUrl: a.registrationUrl || '',
        registrationStatus: a.registrationStatus || '',
        registrationButtonText: a.registrationButtonText || '',
        registrationDate: a.registrationDate ? a.registrationDate.split('T')[0] : '',
        registrationEndDate: a.registrationEndDate ? a.registrationEndDate.split('T')[0] : '',
        spotsAvailable: a.spotsAvailable?.toString() || '',
        totalSpots: a.totalSpots?.toString() || '',
        cost: a.cost?.toString() || '',
        costIncludesTax: a.costIncludesTax || false,
        taxAmount: a.taxAmount?.toString() || '',
        ageMin: a.ageMin?.toString() || '',
        ageMax: a.ageMax?.toString() || '',
        activityTypeId: a.activityTypeId || '',
        activitySubtypeId: a.activitySubtypeId || '',
        isFeatured: a.isFeatured || false,
        featuredTier: a.featuredTier || '',
        featuredStartDate: a.featuredStartDate ? a.featuredStartDate.split('T')[0] : '',
        featuredEndDate: a.featuredEndDate ? a.featuredEndDate.split('T')[0] : '',
        isActive: a.isActive,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDropdownData = async () => {
    const token = localStorage.getItem('admin_token');

    try {
      const [providersRes, locationsRes, typesRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/activities/providers`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/activities/locations`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/activities/activity-types`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (providersRes.ok) {
        const data = await providersRes.json();
        setProviders(data.providers || []);
      }
      if (locationsRes.ok) {
        const data = await locationsRes.json();
        setLocations(data.locations || []);
      }
      if (typesRes.ok) {
        const data = await typesRes.json();
        setActivityTypes(data.activityTypes || []);
      }
    } catch (err) {
      console.error('Error fetching dropdown data:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleDayOfWeekChange = (day: string) => {
    setFormData(prev => ({
      ...prev,
      dayOfWeek: prev.dayOfWeek.includes(day)
        ? prev.dayOfWeek.filter(d => d !== day)
        : [...prev.dayOfWeek, day]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('admin_token');

      // Prepare data with proper types
      const data: any = {
        name: formData.name,
        description: formData.description || null,
        fullDescription: formData.fullDescription || null,
        category: formData.category || null,
        subcategory: formData.subcategory || null,
        startTime: formData.startTime || null,
        endTime: formData.endTime || null,
        dayOfWeek: formData.dayOfWeek,
        dateStart: formData.dateStart ? new Date(formData.dateStart).toISOString() : null,
        dateEnd: formData.dateEnd ? new Date(formData.dateEnd).toISOString() : null,
        schedule: formData.schedule || null,
        dates: formData.dates || null,
        locationId: formData.locationId || null,
        locationName: formData.locationName || null,
        fullAddress: formData.fullAddress || null,
        registrationUrl: formData.registrationUrl || null,
        registrationStatus: formData.registrationStatus || null,
        registrationButtonText: formData.registrationButtonText || null,
        registrationDate: formData.registrationDate ? new Date(formData.registrationDate).toISOString() : null,
        registrationEndDate: formData.registrationEndDate ? new Date(formData.registrationEndDate).toISOString() : null,
        spotsAvailable: formData.spotsAvailable ? parseInt(formData.spotsAvailable) : null,
        totalSpots: formData.totalSpots ? parseInt(formData.totalSpots) : null,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        costIncludesTax: formData.costIncludesTax,
        taxAmount: formData.taxAmount ? parseFloat(formData.taxAmount) : null,
        ageMin: formData.ageMin ? parseInt(formData.ageMin) : null,
        ageMax: formData.ageMax ? parseInt(formData.ageMax) : null,
        activityTypeId: formData.activityTypeId || null,
        activitySubtypeId: formData.activitySubtypeId || null,
        isFeatured: formData.isFeatured,
        featuredTier: formData.featuredTier || null,
        featuredStartDate: formData.featuredStartDate ? new Date(formData.featuredStartDate).toISOString() : null,
        featuredEndDate: formData.featuredEndDate ? new Date(formData.featuredEndDate).toISOString() : null,
        isActive: formData.isActive,
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/activities/${activityId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save activity');
      }

      const result = await response.json();
      setSuccessMessage(result.message || 'Activity saved successfully!');

      // Refresh activity data
      fetchActivity();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnlockFields = async (fields: string[]) => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/activities/${activityId}/unlock-fields`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fields }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to unlock fields');
      }

      setSuccessMessage(`Unlocked ${fields.length} field(s). Scrapers can now update them.`);
      fetchActivity();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const isFieldLocked = (fieldName: string): boolean => {
    return activity?.manuallyEditedFields?.includes(fieldName) || false;
  };

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const selectedActivityType = activityTypes.find(t => t.id === formData.activityTypeId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E8638B]"></div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error || 'Activity not found'}</p>
        <Link href="/admin/activities" className="text-[#E8638B] hover:underline">
          Back to Activities
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin/activities" className="text-sm text-gray-500 hover:text-gray-700">
            &larr; Back to Activities
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Edit Activity</h1>
        </div>
        <div className="flex items-center gap-2">
          {activity.manuallyEditedFields.length > 0 && (
            <button
              type="button"
              onClick={() => handleUnlockFields(activity.manuallyEditedFields)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Unlock All Fields ({activity.manuallyEditedFields.length})
            </button>
          )}
        </div>
      </div>

      {/* Provider Info */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-gray-500">Provider:</span>
            <span className="ml-2 font-medium">{activity.provider?.name}</span>
          </div>
          <div>
            <span className="text-sm text-gray-500">External ID:</span>
            <span className="ml-2 font-mono text-sm">{activity.externalId}</span>
          </div>
        </div>
      </div>

      {/* Manual Edit Warning */}
      {activity.manuallyEditedFields.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium text-blue-900">Protected Fields</p>
              <p className="text-sm text-blue-700 mt-1">
                The following fields have been manually edited and will not be overwritten by scrapers:
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {activity.manuallyEditedFields.map(field => (
                  <span
                    key={field}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                  >
                    {field}
                    <button
                      type="button"
                      onClick={() => handleUnlockFields([field])}
                      className="hover:text-blue-600"
                      title="Unlock this field"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-6">
          <p className="text-green-600">{successMessage}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
                {isFieldLocked('name') && <span className="ml-2 text-xs text-blue-600">(Protected)</span>}
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
                {isFieldLocked('description') && <span className="ml-2 text-xs text-blue-600">(Protected)</span>}
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
                {isFieldLocked('category') && <span className="ml-2 text-xs text-blue-600">(Protected)</span>}
              </label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
              <input
                type="text"
                name="subcategory"
                value={formData.subcategory}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Activity Type</label>
              <select
                name="activityTypeId"
                value={formData.activityTypeId}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
              >
                <option value="">Select Type</option>
                {activityTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Activity Subtype</label>
              <select
                name="activitySubtypeId"
                value={formData.activitySubtypeId}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
                disabled={!selectedActivityType}
              >
                <option value="">Select Subtype</option>
                {selectedActivityType?.subtypes.map(subtype => (
                  <option key={subtype.id} value={subtype.id}>{subtype.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Schedule</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="text"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                placeholder="e.g., 9:00 am"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="text"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                placeholder="e.g., 10:00 am"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Days of Week</label>
              <div className="flex flex-wrap gap-2">
                {daysOfWeek.map(day => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDayOfWeekChange(day)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      formData.dayOfWeek.includes(day)
                        ? 'bg-[#E8638B] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Start</label>
              <input
                type="date"
                name="dateStart"
                value={formData.dateStart}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date End</label>
              <input
                type="date"
                name="dateEnd"
                value={formData.dateEnd}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Schedule (text)</label>
              <input
                type="text"
                name="schedule"
                value={formData.schedule}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Location</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <select
                name="locationId"
                value={formData.locationId}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
              >
                <option value="">Select Location</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name} - {loc.city}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location Name (override)</label>
              <input
                type="text"
                name="locationName"
                value={formData.locationName}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Address</label>
              <input
                type="text"
                name="fullAddress"
                value={formData.fullAddress}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Registration */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Registration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Registration URL</label>
              <input
                type="url"
                name="registrationUrl"
                value={formData.registrationUrl}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Registration Status</label>
              <select
                name="registrationStatus"
                value={formData.registrationStatus}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
              >
                <option value="">Select Status</option>
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
                <option value="Coming Soon">Coming Soon</option>
                <option value="Waitlist">Waitlist</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Button Text</label>
              <input
                type="text"
                name="registrationButtonText"
                value={formData.registrationButtonText}
                onChange={handleChange}
                placeholder="e.g., Register Now"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Registration Opens</label>
              <input
                type="date"
                name="registrationDate"
                value={formData.registrationDate}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Registration Closes</label>
              <input
                type="date"
                name="registrationEndDate"
                value={formData.registrationEndDate}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Spots Available</label>
              <input
                type="number"
                name="spotsAvailable"
                value={formData.spotsAvailable}
                onChange={handleChange}
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Spots</label>
              <input
                type="number"
                name="totalSpots"
                value={formData.totalSpots}
                onChange={handleChange}
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pricing</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cost
                {isFieldLocked('cost') && <span className="ml-2 text-xs text-blue-600">(Protected)</span>}
              </label>
              <input
                type="number"
                name="cost"
                value={formData.cost}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax Amount</label>
              <input
                type="number"
                name="taxAmount"
                value={formData.taxAmount}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
              />
            </div>
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="costIncludesTax"
                  checked={formData.costIncludesTax}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-[#E8638B] focus:ring-[#E8638B]"
                />
                <span className="text-sm text-gray-700">Cost includes tax</span>
              </label>
            </div>
          </div>
        </div>

        {/* Age Requirements */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Age Requirements</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Age
                {isFieldLocked('ageMin') && <span className="ml-2 text-xs text-blue-600">(Protected)</span>}
              </label>
              <input
                type="number"
                name="ageMin"
                value={formData.ageMin}
                onChange={handleChange}
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Age
                {isFieldLocked('ageMax') && <span className="ml-2 text-xs text-blue-600">(Protected)</span>}
              </label>
              <input
                type="number"
                name="ageMax"
                value={formData.ageMax}
                onChange={handleChange}
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Sponsored Partner Settings */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sponsored Partner Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isFeatured"
                  checked={formData.isFeatured}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-[#E8638B] focus:ring-[#E8638B]"
                />
                <span className="text-sm font-medium text-gray-700">Is Sponsored Activity</span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sponsored Tier</label>
              <select
                name="featuredTier"
                value={formData.featuredTier}
                onChange={handleChange}
                disabled={!formData.isFeatured}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent disabled:bg-gray-100"
              >
                <option value="">Select Tier</option>
                <option value="gold">Gold</option>
                <option value="silver">Silver</option>
                <option value="bronze">Bronze</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sponsored Start Date</label>
              <input
                type="date"
                name="featuredStartDate"
                value={formData.featuredStartDate}
                onChange={handleChange}
                disabled={!formData.isFeatured}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sponsored End Date</label>
              <input
                type="date"
                name="featuredEndDate"
                value={formData.featuredEndDate}
                onChange={handleChange}
                disabled={!formData.isFeatured}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent disabled:bg-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Status</h2>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              className="rounded border-gray-300 text-[#E8638B] focus:ring-[#E8638B]"
            />
            <span className="text-sm font-medium text-gray-700">Activity is Active</span>
          </label>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-4">
          <Link
            href="/admin/activities"
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2 bg-[#E8638B] text-white rounded-lg hover:bg-[#D53F8C] transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
