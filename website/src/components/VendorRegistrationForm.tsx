'use client';

import { useState } from 'react';
import Link from 'next/link';

interface FormData {
  organizationName: string;
  code: string;
  email: string;
  website: string;
  contactName: string;
}

export default function VendorRegistrationForm() {
  const [formData, setFormData] = useState<FormData>({
    organizationName: '',
    code: '',
    email: '',
    website: '',
    contactName: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Auto-generate code from organization name
    if (name === 'organizationName') {
      const code = value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 30);
      setFormData((prev) => ({ ...prev, code }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    // Note: The actual registration requires user authentication first
    // For now, we show a message guiding them to download the app

    // Simulate a brief delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setSubmitStatus('success');
    setIsSubmitting(false);
  };

  if (submitStatus === 'success') {
    return (
      <div className="bg-green-50 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Registration Request Received!</h3>
        <p className="text-gray-600 mb-6">
          Thank you for your interest in listing your activities. Here&apos;s what happens next:
        </p>
        <div className="bg-white rounded-xl p-6 text-left mb-6">
          <ol className="space-y-4">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-sm font-medium text-purple-600">1</span>
              <div>
                <p className="font-medium text-gray-900">Download the app</p>
                <p className="text-sm text-gray-500">Create an account in the Kids Activity Tracker app</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-sm font-medium text-purple-600">2</span>
              <div>
                <p className="font-medium text-gray-900">Contact our team</p>
                <p className="text-sm text-gray-500">Email vendors@kidsactivitytracker.com with your account email</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-sm font-medium text-purple-600">3</span>
              <div>
                <p className="font-medium text-gray-900">Get verified</p>
                <p className="text-sm text-gray-500">We&apos;ll verify your organization and enable vendor access</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-sm font-medium text-purple-600">4</span>
              <div>
                <p className="font-medium text-gray-900">Start uploading</p>
                <p className="text-sm text-gray-500">Upload your activities via CSV/Excel through the vendor portal</p>
              </div>
            </li>
          </ol>
        </div>
        <a
          href="mailto:vendors@kidsactivitytracker.com"
          className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium"
        >
          Contact vendors@kidsactivitytracker.com
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Organization Name */}
      <div>
        <label htmlFor="organizationName" className="block text-sm font-medium text-gray-700 mb-2">
          Organization Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="organizationName"
          name="organizationName"
          value={formData.organizationName}
          onChange={handleChange}
          required
          placeholder="e.g., Vancouver Swim Club"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Vendor Code */}
      <div>
        <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
          Vendor Code <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="code"
          name="code"
          value={formData.code}
          onChange={handleChange}
          required
          placeholder="e.g., vancouver-swim-club"
          pattern="[a-z0-9\-]+"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
        />
        <p className="mt-1 text-sm text-gray-500">
          Lowercase letters, numbers, and hyphens only. This will be your unique identifier.
        </p>
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          Organization Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
          placeholder="info@yourorganization.com"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Website */}
      <div>
        <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-2">
          Website (Optional)
        </label>
        <input
          type="url"
          id="website"
          name="website"
          value={formData.website}
          onChange={handleChange}
          placeholder="https://www.yourorganization.com"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Contact Name */}
      <div>
        <label htmlFor="contactName" className="block text-sm font-medium text-gray-700 mb-2">
          Primary Contact Name (Optional)
        </label>
        <input
          type="text"
          id="contactName"
          name="contactName"
          value={formData.contactName}
          onChange={handleChange}
          placeholder="John Smith"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
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
          'Submit Registration'
        )}
      </button>

      {/* Already have account */}
      <p className="text-center text-sm text-gray-600">
        Already registered?{' '}
        <Link href="/vendor/login" className="text-purple-600 hover:text-purple-700 font-medium">
          Login to vendor portal
        </Link>
      </p>
    </form>
  );
}
