'use client';

import { useState } from 'react';
import Link from 'next/link';

interface FAQItem {
  question: string;
  answer: string | React.ReactNode;
  category: string;
}

const faqs: FAQItem[] = [
  // About the App
  {
    category: 'About the App',
    question: 'What is Kids Activity Tracker?',
    answer: 'Kids Activity Tracker is a free app designed to help Canadian families discover and organize recreational activities for their children. We aggregate programs from community centres, recreation departments, and activity providers across Canada, making it easy to find swimming lessons, sports programs, arts classes, music lessons, and more in your area.',
  },
  {
    category: 'About the App',
    question: 'Is Kids Activity Tracker free to use?',
    answer: 'Yes! Our core features are completely free, including AI-powered search, browsing activities, filtering by age and category, viewing program details, and joining waitlists. We offer an optional premium subscription for families who want additional features like unlimited favourites, AI activity explanations, weekly schedule planning, and push notification alerts.',
  },
  {
    category: 'About the App',
    question: 'Which cities do you support?',
    answer: (
      <>
        We currently support activities in over 50 cities across Canada, with a focus on British Columbia and Ontario. We&apos;re constantly expanding to new cities.{' '}
        <Link href="/cities" className="text-purple-600 hover:text-purple-700 underline">
          View our full list of supported cities
        </Link>
        .
      </>
    ),
  },

  // Activity Information
  {
    category: 'Activity Information',
    question: 'How accurate is the activity information in the app?',
    answer: 'We work diligently to provide accurate and up-to-date activity information. However, program details such as schedules, pricing, availability, and registration dates may change without notice. When there is a discrepancy between our app and the official activity provider\'s website, please consider the provider\'s website as the authoritative source. We recommend verifying important details directly with the activity provider before registering.',
  },
  {
    category: 'Activity Information',
    question: 'How often is the activity information updated?',
    answer: 'We update our activity database daily. Our automated systems continuously scan partner websites for new programs, schedule changes, and updated information. We also add support for new organizations and activity providers on an ongoing basis to expand our coverage.',
  },
  {
    category: 'Activity Information',
    question: 'Why might some activities be missing or have incomplete information?',
    answer: 'Activity information is sourced from various providers who format their data differently. Occasionally, some details may not be captured or may display differently than on the source website. If you notice missing or incorrect information, please let us know through the app\'s feedback feature, and we\'ll work to improve it.',
  },

  // AI Features
  {
    category: 'AI Features',
    question: 'How does the AI-powered search work?',
    answer: 'Our AI understands natural language queries like "swimming lessons for my 5 year old on Saturday mornings near downtown." It automatically extracts the activity type, age, schedule preferences, and location to find the best matches. No need to fill out complex filter forms!',
  },
  {
    category: 'AI Features',
    question: 'What are AI activity explanations?',
    answer: 'When viewing any activity, you can tap "Why is this good for my child?" to get a personalized AI explanation. It analyzes the activity against your child\'s age and interests, explaining the physical, social, cognitive, and emotional benefits with a match score.',
  },
  {
    category: 'AI Features',
    question: 'How do waitlist alerts and push notifications work?',
    answer: 'When an activity is full, you can join its waitlist. Our system continuously monitors for availability changes. The moment a spot opens up, you\'ll receive an instant push notification to your phone so you can register before it fills up again.',
  },

  // Requests & Feedback
  {
    category: 'Requests & Feedback',
    question: 'My city or a local organization is not listed. Can you add it?',
    answer: (
      <>
        Absolutely! We&apos;re always looking to expand our coverage. If your city or a local activity provider is missing from our app, please{' '}
        <Link href="/request-city" className="text-purple-600 hover:text-purple-700 underline">
          submit a request here
        </Link>
        . Include the city name, province, and if possible, links to local recreation centres or activity providers. We review all requests and prioritize additions based on demand.
      </>
    ),
  },
  {
    category: 'Requests & Feedback',
    question: 'How can I report incorrect information or provide feedback?',
    answer: 'We appreciate your help in keeping our information accurate! You can report issues or provide feedback directly through the app by tapping the feedback button on any activity, or by emailing us at support@kidsactivitytracker.ca. Please include as much detail as possible so we can investigate and make corrections.',
  },

  // Registration & Booking
  {
    category: 'Registration & Booking',
    question: 'Can I register for activities directly through the app?',
    answer: 'Kids Activity Tracker helps you discover and compare activities, but registration is handled directly through the activity provider\'s website. When you find an activity you\'re interested in, tap the "Register" button to be directed to the provider\'s official registration page. This ensures you have access to the most current availability and pricing.',
  },
  {
    category: 'Registration & Booking',
    question: 'Do you partner with the activity providers listed?',
    answer: 'We aggregate publicly available information from community centres, recreation departments, and activity providers across Canada. Some providers are official partners who work with us directly to ensure their information is accurate and up-to-date. All activity registrations and payments are processed directly by the respective providers.',
  },

  // Account & Privacy
  {
    category: 'Account & Privacy',
    question: 'Do I need an account to use the app?',
    answer: 'Yes, a free account is required to use the app. Creating an account allows you to save favourite activities, set up personalized filters for age and location, receive alerts for registration openings, and sync your preferences across devices.',
  },
  {
    category: 'Account & Privacy',
    question: 'How do you protect my family\'s privacy?',
    answer: 'We take privacy seriously. We only collect information necessary to provide our services, and we never sell your personal data to third parties. Children\'s information (such as ages used for filtering) is stored securely and used only to personalize activity recommendations. Please review our Privacy Policy for complete details.',
  },

  // Technical Support
  {
    category: 'Technical Support',
    question: 'Which devices is the app available on?',
    answer: 'Kids Activity Tracker is available for both iOS (iPhone and iPad) on the App Store and Android devices on the Google Play Store. Both versions include all features including AI-powered search, push notifications, and waitlist alerts.',
  },
  {
    category: 'Technical Support',
    question: 'I\'m experiencing technical issues with the app. What should I do?',
    answer: 'First, try closing and reopening the app, or restarting your device. Make sure you have the latest version installed from the App Store. If issues persist, please contact us at support@kidsactivitytracker.ca with a description of the problem, your device type, and app version.',
  },
];

// Group FAQs by category
const categories = [...new Set(faqs.map(faq => faq.category))];

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filteredFaqs = activeCategory === 'all'
    ? faqs
    : faqs.filter(faq => faq.category === activeCategory);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      {/* Hero Section */}
      <section className="py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Frequently Asked <span className="gradient-text">Questions</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Find answers to common questions about Kids Activity Tracker.
            Can&apos;t find what you&apos;re looking for? Contact us anytime.
          </p>
        </div>
      </section>

      {/* Category Filter */}
      <section className="pb-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-purple-50 border border-gray-200'
              }`}
            >
              All Questions
            </button>
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === category
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-purple-50 border border-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ List */}
      <section className="pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-4">
            {filteredFaqs.map((faq, index) => (
              <div
                key={index}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <span className="text-xs font-medium text-purple-600 uppercase tracking-wide">
                      {faq.category}
                    </span>
                    <h3 className="text-lg font-semibold text-gray-900 mt-1">
                      {faq.question}
                    </h3>
                  </div>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center transition-transform ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}>
                    <svg
                      className="w-5 h-5 text-purple-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </button>
                {openIndex === index && (
                  <div className="px-6 pb-5">
                    <div className="text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
                      {faq.answer}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-purple-600 to-pink-500 rounded-2xl p-8 sm:p-12 text-center text-white">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              Still have questions?
            </h2>
            <p className="text-purple-100 mb-6 max-w-lg mx-auto">
              We&apos;re here to help! Reach out to our support team and we&apos;ll get back to you as soon as possible.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="mailto:support@kidsactivitytracker.ca"
                className="inline-flex items-center justify-center gap-2 bg-white text-purple-600 px-6 py-3 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email Support
              </a>
              <Link
                href="/request-city"
                className="inline-flex items-center justify-center gap-2 bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Request a City
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
