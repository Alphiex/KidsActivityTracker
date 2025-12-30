'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [cityCount, setCityCount] = useState<string>('50+');

  useEffect(() => {
    // Fetch city count for footer
    const fetchCityCount = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/cities`);
        if (response.ok) {
          const data = await response.json();
          const activeCount = data.data?.filter((c: { activityCount: number }) => c.activityCount > 0).length || 0;
          if (activeCount > 0) {
            // Format: round down to nearest 5 or 10
            if (activeCount >= 100) {
              setCityCount(`${Math.floor(activeCount / 10) * 10}+`);
            } else if (activeCount >= 10) {
              setCityCount(`${Math.floor(activeCount / 5) * 5}+`);
            } else {
              setCityCount(`${activeCount}`);
            }
          }
        }
      } catch {
        // Keep default on error
      }
    };
    fetchCityCount();
  }, []);

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Image
                src="/images/illustrations/app-logo.png"
                alt="Kids Activity Tracker"
                width={40}
                height={40}
                className="rounded-xl"
              />
              <span className="font-bold text-xl text-white">
                Kids Activity Tracker
              </span>
            </Link>
            <p className="text-sm text-gray-400">
              Helping Canadian families find the perfect activities for their children across {cityCount} cities.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-white mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/cities" className="hover:text-purple-400 transition-colors">
                  Supported Cities
                </Link>
              </li>
              <li>
                <Link href="/request-city" className="hover:text-purple-400 transition-colors">
                  Request a City
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-purple-400 transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-purple-400 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="#download" className="hover:text-purple-400 transition-colors">
                  Download App
                </Link>
              </li>
            </ul>
          </div>

          {/* For Vendors */}
          <div>
            <h3 className="font-semibold text-white mb-4">For Vendors</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/vendor" className="hover:text-purple-400 transition-colors">
                  List Your Activities
                </Link>
              </li>
              <li>
                <Link href="/vendor/register" className="hover:text-purple-400 transition-colors">
                  Vendor Registration
                </Link>
              </li>
              <li>
                <Link href="/vendor/login" className="hover:text-purple-400 transition-colors">
                  Vendor Login
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-white mb-4">Contact</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="mailto:support@kidsactivitytracker.com"
                  className="hover:text-purple-400 transition-colors"
                >
                  support@kidsactivitytracker.com
                </a>
              </li>
            </ul>

            {/* App Store Badges */}
            <div className="flex gap-3 mt-4">
              <a
                href={process.env.NEXT_PUBLIC_APP_STORE_URL || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-80 hover:opacity-100 transition-opacity"
              >
                <div className="bg-gray-800 rounded-lg px-3 py-2 flex items-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  <span className="text-xs">App Store</span>
                </div>
              </a>
              <div className="opacity-60 cursor-not-allowed">
                <div className="bg-gray-800 rounded-lg px-3 py-2 flex items-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                  </svg>
                  <span className="text-xs">Coming Soon</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 mt-8 pt-8 text-sm text-gray-500">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
              <p>&copy; {currentYear} Kids Activity Tracker. All rights reserved.</p>
              <div className="flex items-center gap-4">
                <Link href="/privacy" className="hover:text-purple-400 transition-colors">
                  Privacy Policy
                </Link>
              </div>
            </div>

            {/* Made in Canada Badge */}
            <div className="flex items-center gap-2 text-gray-400">
              <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L9.5 8.5L3 9.5L7.5 14L6.5 21L12 17.5L17.5 21L16.5 14L21 9.5L14.5 8.5L12 2Z"/>
              </svg>
              <span>Proudly Made in Canada</span>
              <span className="text-lg">🇨🇦</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
