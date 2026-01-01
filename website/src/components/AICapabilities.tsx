'use client';

import { useState } from 'react';

interface AICapability {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  gradient: string;
  example?: string;
}

const capabilities: AICapability[] = [
  {
    id: 'natural-search',
    title: 'Natural Language Search',
    subtitle: 'Just ask like you would a friend',
    description: 'Type naturally like "swimming lessons for my 5 year old on Saturday mornings" and our AI instantly understands age, activity type, schedule, and location preferences.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    gradient: 'from-purple-500 to-purple-600',
    example: '"soccer for kids aged 8-10 near downtown after school"',
  },
  {
    id: 'smart-recommendations',
    title: 'Smart Recommendations',
    subtitle: 'Know why activities are perfect for your child',
    description: 'Get AI-powered explanations of physical, social, cognitive, and emotional benefits. See personalized match scores based on your child\'s age and interests.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    gradient: 'from-amber-500 to-orange-500',
    example: '95% match • Physical, Social, Cognitive benefits',
  },
  {
    id: 'waitlist-alerts',
    title: 'Waitlist Alerts',
    subtitle: 'Never miss a spot again',
    description: 'Join waitlists for full activities and get instant push notifications the moment spots open up. Be first in line to register before it fills again.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    gradient: 'from-green-500 to-emerald-500',
    example: '🔔 "2 spots just opened in Swimming Level 3!"',
  },
  {
    id: 'weekly-planner',
    title: 'Weekly Schedule Planner',
    subtitle: 'AI-optimized family schedules',
    description: 'Let our AI create the perfect weekly activity schedule for your family. Considers multiple children, locations, time preferences, and avoids conflicts.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    gradient: 'from-sky-500 to-blue-500',
    example: 'Mon: Soccer • Tue: Piano • Wed: Swimming • Thu: Art',
  },
];

export default function AICapabilities() {
  const [activeCapability, setActiveCapability] = useState<string>('natural-search');
  const activeItem = capabilities.find(c => c.id === activeCapability) || capabilities[0];

  return (
    <section className="py-20 bg-gradient-to-b from-gray-900 to-gray-800 text-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center px-4 py-2 bg-purple-500/20 rounded-full text-purple-300 font-medium text-sm mb-4">
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
            </svg>
            Powered by AI
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Smarter Activity Discovery with{' '}
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Artificial Intelligence
            </span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Our AI understands your family's needs and helps you find, track, and never miss 
            the perfect activities for your children.
          </p>
        </div>

        {/* Capability Selector */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left: Capability Cards */}
          <div className="space-y-4">
            {capabilities.map((capability) => (
              <button
                key={capability.id}
                onClick={() => setActiveCapability(capability.id)}
                className={`w-full text-left p-4 sm:p-5 rounded-xl transition-all duration-300 ${
                  activeCapability === capability.id
                    ? 'bg-white/10 border-2 border-purple-500 shadow-lg shadow-purple-500/20'
                    : 'bg-white/5 border-2 border-transparent hover:bg-white/10 hover:border-gray-600'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${capability.gradient} text-white flex-shrink-0`}>
                    {capability.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-white mb-1">
                      {capability.title}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      {capability.subtitle}
                    </p>
                  </div>
                  {activeCapability === capability.id && (
                    <svg className="w-6 h-6 text-purple-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Right: Active Capability Detail */}
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-3xl blur-2xl" />
            
            <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 sm:p-8 border border-gray-700">
              {/* Icon */}
              <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${activeItem.gradient} text-white mb-6`}>
                {activeItem.icon}
              </div>

              {/* Title */}
              <h3 className="text-2xl font-bold mb-2">
                {activeItem.title}
              </h3>
              <p className="text-purple-400 font-medium mb-4">
                {activeItem.subtitle}
              </p>

              {/* Description */}
              <p className="text-gray-300 leading-relaxed mb-6">
                {activeItem.description}
              </p>

              {/* Example */}
              {activeItem.example && (
                <div className="bg-black/30 rounded-xl p-4 border border-gray-700">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Example</div>
                  <p className="text-white font-mono text-sm">
                    {activeItem.example}
                  </p>
                </div>
              )}

              {/* Decorative elements */}
              <div className="absolute top-4 right-4 w-20 h-20 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full blur-xl" />
              <div className="absolute bottom-4 left-4 w-16 h-16 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full blur-xl" />
            </div>
          </div>
        </div>

        {/* Example Results Section */}
        <div className="mt-16">
          <div className="text-center mb-8">
            <h3 className="text-xl font-semibold text-gray-300 mb-2">See AI in Action</h3>
            <p className="text-gray-500">Real examples of what our AI can find for you</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-xl p-4 border border-gray-700">
              <div className="text-purple-400 text-sm font-medium mb-2">Query</div>
              <p className="text-white text-sm mb-3">&quot;swimming for toddlers on weekends&quot;</p>
              <div className="text-green-400 text-xs">✓ Found 47 matching activities</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-gray-700">
              <div className="text-purple-400 text-sm font-medium mb-2">Query</div>
              <p className="text-white text-sm mb-3">&quot;art classes under $50 for 8 year old&quot;</p>
              <div className="text-green-400 text-xs">✓ Found 23 matching activities</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-gray-700">
              <div className="text-purple-400 text-sm font-medium mb-2">Query</div>
              <p className="text-white text-sm mb-3">&quot;soccer camps this summer near me&quot;</p>
              <div className="text-green-400 text-xs">✓ Found 12 matching activities</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
