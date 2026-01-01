import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - Kids Activity Tracker',
  description: 'Terms of Service for Kids Activity Tracker - Read our terms and conditions for using the app.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      {/* Hero Section */}
      <section className="py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Terms of <span className="gradient-text">Service</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Please read these terms carefully before using Kids Activity Tracker.
          </p>
          <p className="text-sm text-gray-500 mt-4">
            <strong>Effective Date:</strong> December 31, 2025 | <strong>Last Updated:</strong> December 31, 2025
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-12 space-y-12">

            {/* Acceptance of Terms */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-600 leading-relaxed">
                By downloading, installing, or using the Kids Activity Tracker mobile application (&quot;App&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, please do not use the App.
              </p>
              <p className="text-gray-600 leading-relaxed mt-4">
                These Terms constitute a legally binding agreement between you and Kids Activity Tracker (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) regarding your use of the App.
              </p>
            </div>

            {/* Description of Service */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Description of Service</h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                Kids Activity Tracker is a mobile application that helps parents and guardians discover children&apos;s activities, programs, and events in their local area. Our services include:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li>Activity discovery and search functionality</li>
                <li>Personalized recommendations based on child profiles</li>
                <li>Calendar integration for activity scheduling</li>
                <li>Favorite activity saving</li>
                <li>AI-powered activity recommendations (Premium feature)</li>
                <li>Family sharing features (Premium feature)</li>
              </ul>
            </div>

            {/* User Accounts */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. User Accounts</h2>

              <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Account Creation</h3>
              <p className="text-gray-600 leading-relaxed">
                To access certain features of the App, you must create an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current, and complete.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Account Security</h3>
              <p className="text-gray-600 leading-relaxed">
                You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Account Termination</h3>
              <p className="text-gray-600 leading-relaxed">
                You may delete your account at any time through the App settings. We reserve the right to suspend or terminate accounts that violate these Terms.
              </p>
            </div>

            {/* Subscriptions and Payments */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Subscriptions and Payments</h2>

              <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Free and Premium Tiers</h3>
              <p className="text-gray-600 leading-relaxed">
                The App offers both free (&quot;Discovery&quot;) and paid (&quot;Family Pro&quot;) subscription tiers. Free tier users have access to basic features with certain limitations. Premium subscribers have access to unlimited features.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Subscription Terms</h3>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li>Subscriptions are billed on a monthly or annual basis</li>
                <li>Payment is processed through Apple App Store or Google Play Store</li>
                <li>Subscriptions automatically renew unless cancelled at least 24 hours before the renewal date</li>
                <li>You can manage and cancel subscriptions through your device&apos;s app store settings</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Refunds</h3>
              <p className="text-gray-600 leading-relaxed">
                Refund requests must be submitted through the Apple App Store or Google Play Store according to their respective refund policies.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Free Trial</h3>
              <p className="text-gray-600 leading-relaxed">
                We may offer free trial periods for Premium subscriptions. If you do not cancel before the trial ends, you will be automatically charged for the subscription.
              </p>
            </div>

            {/* User Conduct */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">5. User Conduct</h2>
              <p className="text-gray-600 leading-relaxed mb-4">You agree not to:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li>Use the App for any unlawful purpose</li>
                <li>Attempt to gain unauthorized access to the App or its systems</li>
                <li>Interfere with or disrupt the App&apos;s functionality</li>
                <li>Scrape, data mine, or extract data from the App without permission</li>
                <li>Create multiple accounts to circumvent limitations</li>
                <li>Share your account credentials with others</li>
                <li>Use automated systems or bots to access the App</li>
                <li>Reverse engineer or decompile any part of the App</li>
              </ul>
            </div>

            {/* Activity Information Disclaimer */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Activity Information Disclaimer</h2>

              <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 mb-4">
                <p className="text-amber-800 text-sm">
                  <strong>Important:</strong> Kids Activity Tracker aggregates activity information from various third-party sources. We make reasonable efforts to ensure accuracy, but we cannot guarantee the completeness or accuracy of all information.
                </p>
              </div>

              <p className="text-gray-600 leading-relaxed">
                Activity details including schedules, prices, availability, and registration requirements are provided by third-party activity providers. We recommend:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4 mt-2">
                <li>Always verify activity details directly with the provider before registering</li>
                <li>Confirming current pricing and availability</li>
                <li>Reviewing the provider&apos;s own terms and policies</li>
                <li>Contacting the provider directly for any questions</li>
              </ul>

              <p className="text-gray-600 leading-relaxed mt-4">
                We are not responsible for cancellations, changes, or issues with third-party activities. Registration and payment for activities are handled directly by the activity providers, not through our App.
              </p>
            </div>

            {/* Intellectual Property */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Intellectual Property</h2>
              <p className="text-gray-600 leading-relaxed">
                The App, including its design, features, content, and functionality, is owned by Kids Activity Tracker and is protected by copyright, trademark, and other intellectual property laws.
              </p>
              <p className="text-gray-600 leading-relaxed mt-4">
                You are granted a limited, non-exclusive, non-transferable license to use the App for personal, non-commercial purposes in accordance with these Terms.
              </p>
            </div>

            {/* Privacy */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Privacy</h2>
              <p className="text-gray-600 leading-relaxed">
                Your use of the App is also governed by our <Link href="/privacy" className="text-pink-600 hover:text-pink-700 font-medium">Privacy Policy</Link>, which describes how we collect, use, and protect your personal information. By using the App, you consent to our data practices as described in the Privacy Policy.
              </p>
            </div>

            {/* Limitation of Liability */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Limitation of Liability</h2>
              <p className="text-gray-600 leading-relaxed">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, KIDS ACTIVITY TRACKER SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4 mt-2">
                <li>Loss of profits, data, or goodwill</li>
                <li>Service interruptions</li>
                <li>Computer damage or system failures</li>
                <li>Any damages arising from your use of or inability to use the App</li>
                <li>Any damages related to third-party activities discovered through the App</li>
              </ul>
              <p className="text-gray-600 leading-relaxed mt-4">
                Our total liability for any claims arising from your use of the App shall not exceed the amount you paid us in the twelve (12) months preceding the claim.
              </p>
            </div>

            {/* Disclaimer of Warranties */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Disclaimer of Warranties</h2>
              <p className="text-gray-600 leading-relaxed">
                THE APP IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              </p>
              <p className="text-gray-600 leading-relaxed mt-4">
                We do not warrant that the App will be uninterrupted, error-free, or secure, or that any defects will be corrected.
              </p>
            </div>

            {/* Indemnification */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Indemnification</h2>
              <p className="text-gray-600 leading-relaxed">
                You agree to indemnify, defend, and hold harmless Kids Activity Tracker and its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including reasonable legal fees) arising from your use of the App, your violation of these Terms, or your violation of any rights of another party.
              </p>
            </div>

            {/* Modifications to Terms */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Modifications to Terms</h2>
              <p className="text-gray-600 leading-relaxed">
                We reserve the right to modify these Terms at any time. We will notify you of material changes by posting the updated Terms in the App and updating the &quot;Last Updated&quot; date.
              </p>
              <p className="text-gray-600 leading-relaxed mt-4">
                Your continued use of the App after changes become effective constitutes your acceptance of the modified Terms.
              </p>
            </div>

            {/* Governing Law */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">13. Governing Law</h2>
              <p className="text-gray-600 leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of the Province of British Columbia, Canada, without regard to its conflict of law provisions.
              </p>
              <p className="text-gray-600 leading-relaxed mt-4">
                Any disputes arising from these Terms or your use of the App shall be resolved exclusively in the courts located in British Columbia, Canada.
              </p>
            </div>

            {/* Severability */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">14. Severability</h2>
              <p className="text-gray-600 leading-relaxed">
                If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
              </p>
            </div>

            {/* Entire Agreement */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">15. Entire Agreement</h2>
              <p className="text-gray-600 leading-relaxed">
                These Terms, together with our Privacy Policy, constitute the entire agreement between you and Kids Activity Tracker regarding your use of the App and supersede any prior agreements.
              </p>
            </div>

            {/* Contact Us */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">16. Contact Us</h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                If you have any questions about these Terms of Service, please contact us:
              </p>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-800"><strong>Email:</strong> <a href="mailto:support@kidsactivitytracker.app" className="text-pink-600 hover:text-pink-700">support@kidsactivitytracker.app</a></p>
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
