'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getProfile } from '@/lib/vendorApi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.kidsactivitytracker.ca';

const PROVINCES = [
  { code: 'BC', name: 'British Columbia' },
  { code: 'AB', name: 'Alberta' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'ON', name: 'Ontario' },
  { code: 'QC', name: 'Quebec' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
];

const POPULAR_CITIES = [
  'Vancouver', 'Toronto', 'Calgary', 'Edmonton', 'Ottawa',
  'Montreal', 'Winnipeg', 'Victoria', 'Halifax', 'Regina',
  'Saskatoon', 'Burnaby', 'Richmond', 'Surrey', 'Mississauga',
];

export default function TargetingPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [hasTargeting, setHasTargeting] = useState(false);
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [customCity, setCustomCity] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      const response = await getProfile();
      if (response.success && response.vendor) {
        const isActive = response.vendor.subscriptionStatus === 'active';
        setIsSubscribed(isActive);

        // Check if plan has targeting feature (Silver or Gold)
        const plan = response.vendor.plan;
        setHasTargeting(isActive && plan?.features?.targeting);

        // Load existing targeting settings
        if (response.vendor.targetProvinces) {
          setSelectedProvinces(response.vendor.targetProvinces);
        }
        if (response.vendor.targetCities) {
          setSelectedCities(response.vendor.targetCities);
        }
      }
    } catch (err) {
      console.error('Failed to check subscription');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleProvince = (code: string) => {
    setSelectedProvinces(prev =>
      prev.includes(code) ? prev.filter(p => p !== code) : [...prev, code]
    );
    setSaveSuccess(false);
  };

  const toggleCity = (city: string) => {
    setSelectedCities(prev =>
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    );
    setSaveSuccess(false);
  };

  const addCustomCity = () => {
    const city = customCity.trim();
    if (city && !selectedCities.includes(city)) {
      setSelectedCities(prev => [...prev, city]);
      setCustomCity('');
      setSaveSuccess(false);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('vendor_token');
      const response = await fetch(`${API_URL}/api/vendor/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetProvinces: selectedProvinces,
          targetCities: selectedCities,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSaveSuccess(true);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E8638B]"></div>
      </div>
    );
  }

  // Show upgrade prompt for non-subscribers or Bronze tier
  if (!isSubscribed || !hasTargeting) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Geographic Targeting</h1>
          <p className="text-gray-500 mt-1">Focus your visibility on specific regions</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Blurred preview */}
          <div className="relative">
            <div className="filter blur-sm pointer-events-none p-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {PROVINCES.slice(0, 8).map(p => (
                  <div key={p.code} className="p-4 border rounded-lg">
                    <div className="font-medium">{p.name}</div>
                  </div>
                ))}
              </div>
              <div className="h-48 bg-gray-100 rounded-xl"></div>
            </div>

            {/* Upgrade overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <div className="text-center max-w-md mx-auto p-8">
                <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-[#E8638B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Unlock Geographic Targeting</h2>
                <p className="text-gray-600 mb-6">
                  {isSubscribed
                    ? 'Upgrade to Silver or Gold to access geographic targeting and focus your visibility on specific cities and provinces.'
                    : 'Upgrade to a Silver or Gold sponsor plan to target specific cities and provinces where you offer programs.'}
                </p>
                <Link
                  href="/vendor/dashboard/plans"
                  className="inline-block px-6 py-3 bg-gradient-to-r from-[#E8638B] to-[#D53F8C] text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
                >
                  {isSubscribed ? 'Upgrade to Silver' : 'View Upgrade Options'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show targeting controls for Silver/Gold subscribers
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Geographic Targeting</h1>
          <p className="text-gray-500 mt-1">Focus your visibility on specific regions</p>
        </div>
        <button
          onClick={saveSettings}
          disabled={isSaving}
          className="px-6 py-2 bg-gradient-to-r from-[#E8638B] to-[#D53F8C] text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {saveSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-green-700">Settings saved successfully!</span>
        </div>
      )}

      {/* Province Targeting */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Target Provinces</h2>
        <p className="text-gray-500 text-sm mb-4">
          Select provinces where you want your activities to be highlighted
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {PROVINCES.map((province) => (
            <button
              key={province.code}
              onClick={() => toggleProvince(province.code)}
              className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                selectedProvinces.includes(province.code)
                  ? 'border-[#E8638B] bg-pink-50 text-[#D53F8C]'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {province.name}
            </button>
          ))}
        </div>
      </div>

      {/* City Targeting */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Target Cities</h2>
        <p className="text-gray-500 text-sm mb-4">
          Select specific cities for more focused targeting
        </p>

        {/* Popular cities */}
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Popular Cities</p>
          <div className="flex flex-wrap gap-2">
            {POPULAR_CITIES.map((city) => (
              <button
                key={city}
                onClick={() => toggleCity(city)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedCities.includes(city)
                    ? 'bg-[#E8638B] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        </div>

        {/* Custom city input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={customCity}
            onChange={(e) => setCustomCity(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCustomCity()}
            placeholder="Add another city..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
          />
          <button
            onClick={addCustomCity}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Add
          </button>
        </div>

        {/* Selected cities */}
        {selectedCities.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Selected Cities ({selectedCities.length})</p>
            <div className="flex flex-wrap gap-2">
              {selectedCities.map((city) => (
                <span
                  key={city}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-pink-100 text-[#D53F8C] rounded-full text-sm"
                >
                  {city}
                  <button
                    onClick={() => toggleCity(city)}
                    className="ml-1 hover:text-[#B8336B]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-pink-50 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-pink-100 rounded-lg">
            <svg className="w-5 h-5 text-[#E8638B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-medium text-[#B8336B]">How Targeting Works</h3>
            <p className="text-sm text-[#D53F8C] mt-1">
              When you select specific provinces or cities, your activities will receive priority placement
              for parents searching in those locations. If no targeting is set, your activities will be
              shown based on their actual location.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
