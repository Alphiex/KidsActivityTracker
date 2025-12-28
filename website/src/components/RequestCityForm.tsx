'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

const PROVINCES = [
  'Alberta',
  'British Columbia',
  'Manitoba',
  'New Brunswick',
  'Newfoundland and Labrador',
  'Northwest Territories',
  'Nova Scotia',
  'Nunavut',
  'Ontario',
  'Prince Edward Island',
  'Quebec',
  'Saskatchewan',
  'Yukon',
];

interface FormData {
  cityName: string;
  province: string;
  email: string;
  sites: string;
  notes: string;
}

export default function RequestCityForm() {
  const [formData, setFormData] = useState<FormData>({
    cityName: '',
    province: '',
    email: '',
    sites: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      await api.requestCity({
        cityName: formData.cityName,
        province: formData.province,
        email: formData.email,
        sites: formData.sites || undefined,
        notes: formData.notes || undefined,
      });

      setSubmitStatus('success');
      setFormData({
        cityName: '',
        province: '',
        email: '',
        sites: '',
        notes: '',
      });
    } catch (error: any) {
      setSubmitStatus('error');
      setErrorMessage(error.message || 'Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitStatus === 'success') {
    return (
      <div className="bg-green-50 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Request Submitted!</h3>
        <p className="text-gray-600 mb-6">
          Thank you for your request. We&apos;ll review it and notify you at your email address
          when we add support for your city.
        </p>
        <button
          onClick={() => setSubmitStatus('idle')}
          className="text-purple-600 hover:text-purple-700 font-medium"
        >
          Submit another request
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* City Name */}
      <div>
        <label htmlFor="cityName" className="block text-sm font-medium text-gray-700 mb-2">
          City Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="cityName"
          name="cityName"
          value={formData.cityName}
          onChange={handleChange}
          required
          placeholder="e.g., Victoria"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Province */}
      <div>
        <label htmlFor="province" className="block text-sm font-medium text-gray-700 mb-2">
          Province/Territory <span className="text-red-500">*</span>
        </label>
        <select
          id="province"
          name="province"
          value={formData.province}
          onChange={handleChange}
          required
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white"
        >
          <option value="">Select a province</option>
          {PROVINCES.map((province) => (
            <option key={province} value={province}>
              {province}
            </option>
          ))}
        </select>
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          Your Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
          placeholder="you@example.com"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
        />
        <p className="mt-1 text-sm text-gray-500">
          We&apos;ll notify you when we add support for this city
        </p>
      </div>

      {/* Sites/Programs */}
      <div>
        <label htmlFor="sites" className="block text-sm font-medium text-gray-700 mb-2">
          Specific Sites or Programs (Optional)
        </label>
        <textarea
          id="sites"
          name="sites"
          value={formData.sites}
          onChange={handleChange}
          rows={3}
          placeholder="e.g., City recreation centers, local swim clubs, community arts programs..."
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
        />
        <p className="mt-1 text-sm text-gray-500">
          Let us know about specific activity providers you&apos;d like us to add
        </p>
      </div>

      {/* Additional Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
          Additional Notes (Optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={2}
          placeholder="Any additional information..."
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
        />
      </div>

      {/* Error Message */}
      {submitStatus === 'error' && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">
          {errorMessage}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white px-6 py-4 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Submitting...
          </span>
        ) : (
          'Submit Request'
        )}
      </button>
    </form>
  );
}
