'use client';

import Image from 'next/image';

interface Step {
  number: number;
  title: string;
  description: string;
  image: string;
  color: string;
}

const steps: Step[] = [
  {
    number: 1,
    title: 'Ask Naturally',
    description: 'Search like you talk: "swimming for my 5 year old on weekends" — our AI understands and finds matches instantly.',
    image: '/images/illustrations/onboarding-1-discover.png',
    color: 'from-purple-500 to-purple-600',
  },
  {
    number: 2,
    title: 'See Why It\'s Great',
    description: 'Our AI explains exactly how each activity benefits your child\'s development — building confidence, coordination, and social skills.',
    image: '/images/illustrations/onboarding-2-schedule.png',
    color: 'from-pink-500 to-pink-600',
  },
  {
    number: 3,
    title: 'Never Miss a Spot',
    description: 'Join waitlists for full activities and get push notifications the instant spots become available.',
    image: '/images/illustrations/onboarding-3-family.png',
    color: 'from-orange-500 to-orange-600',
  },
];

export default function HowItWorks() {
  return (
    <section className="py-20 bg-gradient-to-b from-purple-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            How It{' '}
            <span className="gradient-text">Works</span>
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Get started in minutes and find the perfect activities for your family
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              {/* Connector line (hidden on mobile, last item) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-32 left-1/2 w-full h-0.5 bg-gradient-to-r from-purple-300 to-pink-300 z-0" />
              )}

              <div className="relative z-10 text-center">
                {/* Image */}
                <div className="relative w-48 h-48 mx-auto mb-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full" />
                  <Image
                    src={step.image}
                    alt={step.title}
                    fill
                    className="object-contain p-4"
                    onError={(e) => {
                      // Hide on error
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  {/* Fallback */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-6xl">
                      {step.number === 1 ? '🔍' : step.number === 2 ? '📅' : '👨‍👩‍👧‍👦'}
                    </span>
                  </div>
                </div>

                {/* Step number */}
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br ${step.color} text-white font-bold text-lg mb-4 shadow-lg`}>
                  {step.number}
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <a
            href="#"
            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-xl font-semibold text-lg hover:from-purple-700 hover:to-pink-600 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            Get Started Free
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
