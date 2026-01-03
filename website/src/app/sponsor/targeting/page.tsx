'use client';

import { useState, useEffect } from 'react';

interface TargetingData {
  targetCities: string[];
  targetProvinces: string[];
}

interface CityData {
  cities: Array<{ id: string; name: string; province: string }>;
  byProvince: Record<string, string[]>;
}

export default function TargetingPage() {
  const [targeting, setTargeting] = useState<TargetingData>({
    targetCities: [],
    targetProvinces: [],
  });
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('sponsor_token');

      const [sponsorRes, citiesRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sponsor/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sponsor/cities`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (sponsorRes.ok) {
        const sponsorData = await sponsorRes.json();
        setTargeting({
          targetCities: sponsorData.sponsor.targetCities || [],
          targetProvinces: sponsorData.sponsor.targetProvinces || [],
        });
      }

      if (citiesRes.ok) {
        const cities = await citiesRes.json();
        setCityData(cities);
      }
    } catch (err) {
      console.error('Failed to load targeting data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('sponsor_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/sponsor/settings`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(targeting),
        }
      );

      if (!response.ok) throw new Error('Failed to save');

      setMessage({ type: 'success', text: 'Targeting settings saved!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleProvince = (province: string) => {
    setTargeting((prev) => ({
      ...prev,
      targetProvinces: prev.targetProvinces.includes(province)
        ? prev.targetProvinces.filter((p) => p !== province)
        : [...prev.targetProvinces, province],
    }));
  };

  const toggleCity = (city: string) => {
    setTargeting((prev) => ({
      ...prev,
      targetCities: prev.targetCities.includes(city)
        ? prev.targetCities.filter((c) => c !== city)
        : [...prev.targetCities, city],
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E8638B]"></div>
      </div>
    );
  }

  const provinces = cityData?.byProvince ? Object.keys(cityData.byProvince) : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Geographic Targeting</h1>
          <p className="text-gray-500 mt-1">
            Choose where your sponsored activities appear
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 bg-[#E8638B] text-white rounded-lg hover:bg-[#D53F8C] transition-colors disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Current Selection Summary */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Selection</h2>
        <div className="space-y-2">
          <p className="text-sm">
            <span className="text-gray-500">Provinces:</span>{' '}
            <span className="text-gray-900">
              {targeting.targetProvinces.length > 0
                ? targeting.targetProvinces.join(', ')
                : 'All provinces (no filter)'}
            </span>
          </p>
          <p className="text-sm">
            <span className="text-gray-500">Cities:</span>{' '}
            <span className="text-gray-900">
              {targeting.targetCities.length > 0
                ? targeting.targetCities.join(', ')
                : 'All cities (no filter)'}
            </span>
          </p>
        </div>
      </div>

      {/* Province Selection */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Provinces</h2>
        <p className="text-sm text-gray-500 mb-4">
          Leave all unchecked to show in all provinces
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {provinces.map((province) => (
            <label
              key={province}
              className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                targeting.targetProvinces.includes(province)
                  ? 'border-[#E8638B] bg-pink-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={targeting.targetProvinces.includes(province)}
                onChange={() => toggleProvince(province)}
                className="rounded text-[#E8638B] focus:ring-[#E8638B]"
              />
              <span className="text-sm font-medium text-gray-900">{province}</span>
            </label>
          ))}
        </div>
      </div>

      {/* City Selection */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cities</h2>
        <p className="text-sm text-gray-500 mb-4">
          Leave all unchecked to show in all cities. If provinces are selected, only cities from those provinces will be shown.
        </p>

        {provinces.map((province) => {
          const cities = cityData?.byProvince[province] || [];
          const isProvinceSelected = targeting.targetProvinces.length === 0 ||
            targeting.targetProvinces.includes(province);

          if (!isProvinceSelected && targeting.targetProvinces.length > 0) {
            return null;
          }

          return (
            <div key={province} className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">{province}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {cities.map((city) => (
                  <label
                    key={city}
                    className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors text-sm ${
                      targeting.targetCities.includes(city)
                        ? 'border-[#E8638B] bg-pink-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={targeting.targetCities.includes(city)}
                      onChange={() => toggleCity(city)}
                      className="rounded text-[#E8638B] focus:ring-[#E8638B]"
                    />
                    <span className="text-gray-900 truncate">{city}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
