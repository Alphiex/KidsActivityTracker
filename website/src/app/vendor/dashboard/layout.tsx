'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PartnerNav from '@/components/PartnerNav';
import Footer from '@/components/Footer';
import { getProfile } from '@/lib/vendorApi';

interface VendorLayoutProps {
  children: React.ReactNode;
}

interface VendorProfile {
  id: string;
  name: string;
  status: string;
  subscriptionStatus?: string;
}

export default function VendorDashboardLayout({ children }: VendorLayoutProps) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [vendorName, setVendorName] = useState('');
  const [vendorStatus, setVendorStatus] = useState<string>('PENDING');
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('vendor_token');
      const name = localStorage.getItem('vendor_name');

      if (!token) {
        router.push('/vendor/login');
        return;
      }

      setVendorName(name || 'Partner');

      // Fetch vendor profile to get status and subscription info
      try {
        const response = await getProfile();
        if (response.success && response.vendor) {
          setVendorStatus(response.vendor.status || 'PENDING');
          setIsSubscribed(response.vendor.subscriptionStatus === 'active');
        }
      } catch (error) {
        console.error('Failed to fetch vendor profile:', error);
        // If profile fetch fails, still allow access but assume PENDING
      }

      setIsAuthenticated(true);
      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('vendor_token');
    localStorage.removeItem('vendor_id');
    localStorage.removeItem('vendor_name');
    router.push('/vendor/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Show pending approval message
  if (vendorStatus === 'PENDING') {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Header is rendered by root layout */}
        <PartnerNav
          vendorName={vendorName}
          isSubscribed={false}
          onLogout={handleLogout}
        />

        <main className="flex-1 bg-gray-50">
          <div className="max-w-2xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Account Pending Approval</h1>
              <p className="text-gray-600 mb-6">
                Thank you for registering as a partner! Your account is currently being reviewed by our team.
                You&apos;ll receive an email notification once your account has been approved.
              </p>
              <p className="text-sm text-gray-500 mb-8">
                This typically takes 1-2 business days. If you have any questions, please contact us at{' '}
                <a href="mailto:vendors@kidsactivitytracker.ca" className="text-purple-600 hover:text-purple-700">
                  vendors@kidsactivitytracker.ca
                </a>
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/"
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Back to Home
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  // Show suspended/rejected message
  if (vendorStatus === 'SUSPENDED' || vendorStatus === 'REJECTED' || vendorStatus === 'INACTIVE') {
    return (
      <div className="min-h-screen flex flex-col">
        <PartnerNav
          vendorName={vendorName}
          isSubscribed={false}
          onLogout={handleLogout}
        />

        <main className="flex-1 bg-gray-50">
          <div className="max-w-2xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Account {vendorStatus.toLowerCase()}</h1>
              <p className="text-gray-600 mb-8">
                Your partner account has been {vendorStatus.toLowerCase()}.
                Please contact our support team for more information.
              </p>
              <a
                href="mailto:support@kidsactivitytracker.ca"
                className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Contact Support
              </a>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  // Active vendor - show full dashboard
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header is rendered by root layout */}
      <PartnerNav
        vendorName={vendorName}
        isSubscribed={isSubscribed}
        onLogout={handleLogout}
      />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}
