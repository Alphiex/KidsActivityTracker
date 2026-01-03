import { Metadata } from 'next';
import VendorRegistrationForm from '@/components/VendorRegistrationForm';

export const metadata: Metadata = {
  title: 'Vendor Registration | Kids Activity Tracker',
  description: 'Register your organization to list activities in Kids Activity Tracker. Reach thousands of families looking for programs for their children.',
};

export default function VendorRegisterPage() {
  return (
    <div className="py-12 bg-gradient-to-br from-[#FFF5F8] via-white to-[#E8F4FF] min-h-screen">
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Vendor <span className="gradient-text">Registration</span>
          </h1>
          <p className="mt-3 text-gray-600">
            Register your organization to list activities in our app
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <VendorRegistrationForm />
        </div>

        {/* Help Text */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Need help? Contact us at{' '}
            <a
              href="mailto:vendors@kidsactivitytracker.ca"
              className="text-[#E8638B] hover:text-[#D53F8C]"
            >
              vendors@kidsactivitytracker.ca
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
