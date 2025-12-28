import { Metadata } from 'next';
import Link from 'next/link';
import RequestCityForm from '@/components/RequestCityForm';

export const metadata: Metadata = {
  title: 'Request a City | Kids Activity Tracker',
  description: 'Request support for your city in Kids Activity Tracker. Help us expand our coverage to include activities for children in your area.',
};

export default function RequestCityPage() {
  return (
    <div className="py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <Link
            href="/cities"
            className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-700 font-medium mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Cities
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Request a <span className="gradient-text">City</span>
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-xl mx-auto">
            Don&apos;t see your city listed? Let us know which city you&apos;d like us to add
            and we&apos;ll prioritize based on demand.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <RequestCityForm />
        </div>

        {/* Additional Info */}
        <div className="mt-12 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            What happens next?
          </h2>
          <div className="grid sm:grid-cols-3 gap-6 text-left">
            <div className="bg-gray-50 rounded-xl p-6">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                <span className="text-purple-600 font-bold">1</span>
              </div>
              <h3 className="font-medium text-gray-900 mb-1">We Review</h3>
              <p className="text-sm text-gray-600">
                Our team reviews your request and researches activity providers in your area.
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-6">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                <span className="text-purple-600 font-bold">2</span>
              </div>
              <h3 className="font-medium text-gray-900 mb-1">We Add Data</h3>
              <p className="text-sm text-gray-600">
                We integrate local recreation centers, clubs, and activity providers.
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-6">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                <span className="text-purple-600 font-bold">3</span>
              </div>
              <h3 className="font-medium text-gray-900 mb-1">You&apos;re Notified</h3>
              <p className="text-sm text-gray-600">
                We&apos;ll email you when your city is live in the app!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
