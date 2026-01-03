'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SponsorLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sponsor/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('sponsor_token', data.token);
      router.push('/sponsor');
    } catch (err: any) {
      // Provide user-friendly error messages
      if (err.message?.includes('fetch') || err.message?.includes('network') || err.name === 'TypeError') {
        setError('Unable to connect to the server. Please check your internet connection and try again.');
      } else if (err.message?.includes('401') || err.message?.includes('credentials') || err.message?.includes('Invalid')) {
        setError('Invalid email or password. Please check your credentials and try again.');
      } else if (err.message?.includes('404')) {
        setError('Account not found. Please check your email address or register for a new account.');
      } else {
        setError(err.message || 'Something went wrong. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FFF5F8] via-white to-[#E8F4FF] px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Partner Portal</h1>
          <p className="mt-2 text-gray-600">Sign in to view your analytics</p>
        </div>

        <div className="bg-white rounded-xl shadow-xl p-8 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <Link href="/sponsor/forgot-password" className="text-sm text-[#E8638B] hover:text-[#D53F8C]">
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8638B] focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#E8638B] text-white rounded-lg font-semibold hover:bg-[#D53F8C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-500">
              Don&apos;t have a partner account?
            </p>
            <Link
              href="/vendor"
              className="text-[#E8638B] hover:text-[#D53F8C] font-medium"
            >
              Become a Partner
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          <Link href="/" className="hover:text-[#E8638B]">
            ← Back to Website
          </Link>
        </p>
      </div>
    </div>
  );
}
