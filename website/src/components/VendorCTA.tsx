import Link from 'next/link';

export default function VendorCTA() {
  return (
    <section className="py-20 bg-gradient-to-br from-purple-600 to-pink-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Are You an Activity Provider?
            </h2>
            <p className="mt-4 text-lg text-purple-100">
              List your programs, classes, and camps in our app and reach
              thousands of families looking for activities for their children.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Upload your activities via CSV or Excel',
                'Manage and update your listings anytime',
                'Get featured with sponsored placements',
                'Reach parents actively searching for activities',
              ].map((item, index) => (
                <li key={index} className="flex items-center gap-3 text-white">
                  <svg className="w-5 h-5 text-purple-200 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link
                href="/vendor/register"
                className="inline-flex items-center justify-center bg-white text-purple-600 px-6 py-3 rounded-full font-semibold hover:bg-purple-50 transition-colors"
              >
                Register as Vendor
              </Link>
              <Link
                href="/vendor"
                className="inline-flex items-center justify-center border-2 border-white text-white px-6 py-3 rounded-full font-semibold hover:bg-white/10 transition-colors"
              >
                Learn More
              </Link>
            </div>
          </div>
          <div className="hidden lg:flex justify-center">
            <div className="relative">
              <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8">
                <div className="space-y-4">
                  {/* Mock upload interface */}
                  <div className="bg-white/20 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-3">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <div>
                        <p className="font-medium">Upload Activities</p>
                        <p className="text-sm opacity-80">CSV or XLSX format</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/20 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-3">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="font-medium">Quick Approval</p>
                        <p className="text-sm opacity-80">Go live in 24 hours</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/20 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-3">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      <div>
                        <p className="font-medium">Track Performance</p>
                        <p className="text-sm opacity-80">Analytics dashboard</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
