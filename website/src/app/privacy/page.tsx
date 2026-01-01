import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - Kids Activity Tracker',
  description: 'Privacy Policy for Kids Activity Tracker - Learn how we collect, use, and protect your information.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      {/* Hero Section */}
      <section className="py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Privacy <span className="gradient-text">Policy</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Your privacy is important to us. This policy explains how we collect, use, and protect your information.
          </p>
          <p className="text-sm text-gray-500 mt-4">
            <strong>Effective Date:</strong> December 29, 2025 | <strong>Last Updated:</strong> December 29, 2025
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-12 space-y-12">

            {/* Introduction */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Introduction</h2>
              <p className="text-gray-600 leading-relaxed">
                Kids Activity Tracker (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy and the privacy of your children. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application.
              </p>
              <p className="text-gray-600 leading-relaxed mt-4">
                Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the application.
              </p>
            </div>

            {/* Information We Collect */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Information We Collect</h2>

              <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Account Information</h3>
              <p className="text-gray-600 leading-relaxed mb-2">When you create an account, we collect:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                <li>Email address</li>
                <li>Name (optional)</li>
                <li>Phone number (optional)</li>
                <li>Password (encrypted)</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Child Profile Information</h3>
              <p className="text-gray-600 leading-relaxed mb-2">To provide personalized activity recommendations, we collect information about your children:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                <li>Child&apos;s name or nickname</li>
                <li>Date of birth (to calculate age for activity filtering)</li>
                <li>Interests and activity preferences</li>
                <li>Allergies or medical conditions (optional, for activity safety)</li>
                <li>Special needs or accommodations (optional)</li>
              </ul>
              <div className="bg-pink-50 border border-pink-100 rounded-lg p-4 mt-4">
                <p className="text-pink-800 text-sm">
                  <strong>Important:</strong> Child profile information is stored securely and is never shared with third parties for marketing purposes. This information is used solely to filter and recommend age-appropriate activities.
                </p>
              </div>

              <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Location Data</h3>
              <p className="text-gray-600 leading-relaxed mb-2">With your permission, we collect:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                <li>GPS coordinates (to find activities near you)</li>
                <li>Saved addresses (home, work, school, etc.)</li>
                <li>Search location history</li>
              </ul>
              <p className="text-gray-600 leading-relaxed mt-2">
                You can disable location services at any time through your device settings. The app will still function but will require manual location entry.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Activity and Usage Data</h3>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                <li>Saved favorite activities</li>
                <li>Search history and filter preferences</li>
                <li>Calendar events and reminders</li>
                <li>Activity registration clicks</li>
                <li>App usage patterns and feature interactions</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Device Information</h3>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                <li>Device type and model</li>
                <li>Operating system version</li>
                <li>App version</li>
                <li>Unique device identifiers</li>
                <li>Crash logs and performance data</li>
              </ul>
            </div>

            {/* How We Use Your Information */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">How We Use Your Information</h2>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Provide Core Services</h3>
                  <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                    <li>Display activities matching your children&apos;s ages and interests</li>
                    <li>Show activities near your location</li>
                    <li>Save your favorites and calendar events</li>
                    <li>Send reminder notifications</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Personalize Your Experience</h3>
                  <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                    <li>Recommend activities based on your preferences</li>
                    <li>Remember your search filters and settings</li>
                    <li>Provide AI-powered activity suggestions</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Improve Our Services</h3>
                  <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                    <li>Analyze usage patterns to improve the app</li>
                    <li>Fix bugs and technical issues</li>
                    <li>Develop new features</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Communicate With You</h3>
                  <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                    <li>Send push notifications about saved activities</li>
                    <li>Alert you to registration openings</li>
                    <li>Provide customer support</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Third-Party Services */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Third-Party Services</h2>
              <p className="text-gray-600 leading-relaxed mb-4">We use the following third-party services:</p>

              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800">RevenueCat</h3>
                  <p className="text-gray-600 text-sm mt-1"><strong>Purpose:</strong> Subscription and payment processing</p>
                  <p className="text-gray-600 text-sm"><strong>Data Shared:</strong> Purchase transactions, subscription status</p>
                  <a href="https://www.revenuecat.com/privacy" className="text-pink-600 hover:text-pink-700 text-sm" target="_blank" rel="noopener noreferrer">View RevenueCat Privacy Policy</a>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800">Google Cloud Platform</h3>
                  <p className="text-gray-600 text-sm mt-1"><strong>Purpose:</strong> Data hosting and storage</p>
                  <p className="text-gray-600 text-sm"><strong>Data Shared:</strong> All app data is stored on Google Cloud servers</p>
                  <a href="https://policies.google.com/privacy" className="text-pink-600 hover:text-pink-700 text-sm" target="_blank" rel="noopener noreferrer">View Google Privacy Policy</a>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800">Apple (for iOS users)</h3>
                  <p className="text-gray-600 text-sm mt-1"><strong>Purpose:</strong> App distribution, notifications, analytics</p>
                  <p className="text-gray-600 text-sm"><strong>Data Shared:</strong> App usage analytics, crash reports</p>
                  <a href="https://www.apple.com/legal/privacy/" className="text-pink-600 hover:text-pink-700 text-sm" target="_blank" rel="noopener noreferrer">View Apple Privacy Policy</a>
                </div>
              </div>

              <p className="text-gray-600 leading-relaxed mt-4 font-medium">
                We do not sell your personal information to third parties.
              </p>
            </div>

            {/* Data Storage and Security */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Data Storage and Security</h2>

              <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-3">Storage Location</h3>
              <p className="text-gray-600 leading-relaxed">
                Your data is stored on secure servers located in the United States (Google Cloud Platform, us-central1 region).
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Security Measures</h3>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                <li>Encryption of data in transit (TLS/SSL)</li>
                <li>Encryption of sensitive data at rest</li>
                <li>Secure password hashing</li>
                <li>Access controls and authentication</li>
                <li>Regular security audits</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Data Retention</h3>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                <li><strong>Account data:</strong> Retained until you delete your account</li>
                <li><strong>Activity data:</strong> Retained for 2 years after last use</li>
                <li><strong>Location data:</strong> Retained for 90 days</li>
                <li><strong>Analytics data:</strong> Aggregated and anonymized after 1 year</li>
              </ul>
            </div>

            {/* Your Rights and Choices */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Rights and Choices</h2>

              <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-3">Account Deletion</h3>
              <p className="text-gray-600 leading-relaxed mb-2">You can delete your account at any time through the app:</p>
              <ol className="list-decimal list-inside text-gray-600 space-y-1 ml-4">
                <li>Go to Settings</li>
                <li>Select &quot;Account&quot;</li>
                <li>Tap &quot;Delete Account&quot;</li>
              </ol>
              <p className="text-gray-600 leading-relaxed mt-2">
                This will permanently delete your account and login credentials, all child profiles, saved favorites and calendar data, and search history and preferences.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Data Export</h3>
              <p className="text-gray-600 leading-relaxed">
                You can export your calendar data in ICS format for use with other calendar applications.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Notification Preferences</h3>
              <p className="text-gray-600 leading-relaxed">
                You can manage push notifications through App Settings &gt; Notifications or your device&apos;s notification settings.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Location Permissions</h3>
              <p className="text-gray-600 leading-relaxed">
                You can revoke location permissions at any time through your device settings. The app will continue to function but will require manual location entry.
              </p>
            </div>

            {/* Children's Privacy */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Children&apos;s Privacy</h2>
              <p className="text-gray-600 leading-relaxed">
                Kids Activity Tracker is designed for parents to find activities for their children. We do not knowingly collect information directly from children under 13.
              </p>
              <p className="text-gray-600 leading-relaxed mt-4">Child profile information is:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                <li>Provided by parents/guardians only</li>
                <li>Used solely for activity filtering and recommendations</li>
                <li>Never shared with third parties for marketing</li>
                <li>Deletable at any time by the parent</li>
              </ul>
              <p className="text-gray-600 leading-relaxed mt-4">
                If you believe we have collected information from a child under 13 without parental consent, please contact us immediately.
              </p>
            </div>

            {/* Regional Privacy Rights */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Regional Privacy Rights</h2>

              <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-3">California Privacy Rights (CCPA)</h3>
              <p className="text-gray-600 leading-relaxed mb-2">If you are a California resident, you have additional rights:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                <li><strong>Right to Know:</strong> Request information about what personal data we collect</li>
                <li><strong>Right to Delete:</strong> Request deletion of your personal data</li>
                <li><strong>Right to Opt-Out:</strong> We do not sell personal information</li>
                <li><strong>Right to Non-Discrimination:</strong> We will not discriminate for exercising your rights</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">European Privacy Rights (GDPR)</h3>
              <p className="text-gray-600 leading-relaxed mb-2">If you are in the European Economic Area (EEA), you have rights under GDPR:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                <li><strong>Right of Access:</strong> Request a copy of your personal data</li>
                <li><strong>Right to Rectification:</strong> Request correction of inaccurate data</li>
                <li><strong>Right to Erasure:</strong> Request deletion of your data</li>
                <li><strong>Right to Restriction:</strong> Request limitation of data processing</li>
                <li><strong>Right to Portability:</strong> Receive your data in a portable format</li>
                <li><strong>Right to Object:</strong> Object to certain processing activities</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Canadian Privacy Rights (PIPEDA)</h3>
              <p className="text-gray-600 leading-relaxed mb-2">If you are a Canadian resident, you have rights under PIPEDA:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                <li>Right to access your personal information</li>
                <li>Right to challenge the accuracy and completeness of your data</li>
                <li>Right to withdraw consent for collection, use, or disclosure</li>
                <li>Right to file a complaint with the Privacy Commissioner of Canada</li>
              </ul>
            </div>

            {/* Changes to Policy */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Changes to This Privacy Policy</h2>
              <p className="text-gray-600 leading-relaxed">
                We may update this privacy policy from time to time. We will notify you of any changes by posting the new privacy policy in the app, updating the &quot;Last Updated&quot; date, and sending a notification for significant changes.
              </p>
              <p className="text-gray-600 leading-relaxed mt-4">
                We encourage you to review this privacy policy periodically.
              </p>
            </div>

            {/* Contact Us */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Contact Us</h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                If you have questions or concerns about this privacy policy or our data practices, please contact us:
              </p>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-800"><strong>Email:</strong> <a href="mailto:privacy@kidsactivitytracker.app" className="text-pink-600 hover:text-pink-700">privacy@kidsactivitytracker.app</a></p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Back to Home */}
      <section className="pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-pink-600 hover:text-pink-700 font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
        </div>
      </section>
    </div>
  );
}
