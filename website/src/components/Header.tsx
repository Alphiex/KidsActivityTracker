'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Hide header on admin and vendor dashboard pages (they have their own navigation)
  if (pathname.startsWith('/admin') || pathname.startsWith('/vendor/dashboard')) {
    return null;
  }

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/illustrations/app-logo.png"
              alt="Kids Activity Tracker"
              width={40}
              height={40}
              className="rounded-xl"
            />
            <span className="font-bold text-xl text-gray-900">
              Kids Activity Tracker
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/cities"
              className="text-gray-600 hover:text-purple-600 font-medium transition-colors"
            >
              Cities
            </Link>
            <Link
              href="/request-city"
              className="text-gray-600 hover:text-purple-600 font-medium transition-colors"
            >
              Request a City
            </Link>
            <Link
              href="/faq"
              className="text-gray-600 hover:text-purple-600 font-medium transition-colors"
            >
              FAQ
            </Link>
            <Link
              href="/vendor"
              className="text-gray-600 hover:text-purple-600 font-medium transition-colors"
            >
              For Vendors
            </Link>
            <Link
              href="#download"
              className="bg-gradient-to-r from-purple-600 to-pink-500 text-white px-5 py-2 rounded-full font-medium hover:opacity-90 transition-opacity"
            >
              Download App
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-600"
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <div className="flex flex-col gap-4">
              <Link
                href="/cities"
                className="text-gray-600 hover:text-purple-600 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Cities
              </Link>
              <Link
                href="/request-city"
                className="text-gray-600 hover:text-purple-600 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Request a City
              </Link>
              <Link
                href="/faq"
                className="text-gray-600 hover:text-purple-600 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                FAQ
              </Link>
              <Link
                href="/vendor"
                className="text-gray-600 hover:text-purple-600 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                For Vendors
              </Link>
              <Link
                href="#download"
                className="bg-gradient-to-r from-purple-600 to-pink-500 text-white px-5 py-2 rounded-full font-medium text-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                Download App
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
