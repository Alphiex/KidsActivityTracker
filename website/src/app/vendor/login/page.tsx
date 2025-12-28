import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Vendor Login | Kids Activity Tracker',
  description: 'Login to the Kids Activity Tracker vendor portal to manage your activity listings.',
};

export default function VendorLoginPage() {
  return (
    <div className="py-12 bg-gray-50 min-h-screen">
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Link
            href="/vendor"
            className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-700 font-medium mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Vendor Info
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            Vendor <span className="gradient-text">Login</span>
          </h1>
          <p className="mt-3 text-gray-600">
            Access your vendor dashboard to manage listings
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          {/* Notice about vendor portal */}
          <div className="bg-purple-50 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-1">Vendor Portal Access</h3>
                <p className="text-sm text-gray-600">
                  The vendor portal is integrated with our main app. To access your vendor dashboard:
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-purple-600 font-bold text-sm">1</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Download the App</p>
                <p className="text-sm text-gray-500">
                  Get Kids Activity Tracker from the App Store or Google Play
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-purple-600 font-bold text-sm">2</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Login with Your Account</p>
                <p className="text-sm text-gray-500">
                  Use your registered vendor email and password
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-purple-600 font-bold text-sm">3</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Access Vendor Portal</p>
                <p className="text-sm text-gray-500">
                  Navigate to Settings &gt; Vendor Portal to manage your listings
                </p>
              </div>
            </div>
          </div>

          {/* Download Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <a
              href="#"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-black text-white px-4 py-3 rounded-xl hover:bg-gray-800 transition-colors"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              <span className="text-sm font-medium">App Store</span>
            </a>
            <a
              href="#"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-black text-white px-4 py-3 rounded-xl hover:bg-gray-800 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
              </svg>
              <span className="text-sm font-medium">Google Play</span>
            </a>
          </div>

          {/* Not registered */}
          <p className="mt-8 text-center text-sm text-gray-600">
            Not registered yet?{' '}
            <Link href="/vendor/register" className="text-purple-600 hover:text-purple-700 font-medium">
              Register as vendor
            </Link>
          </p>
        </div>

        {/* Help Text */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Need help? Contact us at{' '}
            <a
              href="mailto:vendors@kidsactivitytracker.com"
              className="text-purple-600 hover:text-purple-700"
            >
              vendors@kidsactivitytracker.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
