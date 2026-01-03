'use client';

import { useState, useEffect } from 'react';
import { getProfile } from '@/lib/vendorApi';

interface Plan {
  id: string;
  name: string;
  tier: string;
  monthlyPrice: string;
  yearlyPrice: string;
  impressionLimit: number | null;
  features: {
    priority?: boolean;
    analytics?: boolean;
    targeting?: boolean;
    badge?: string;
  };
}

interface CurrentSubscription {
  plan: Plan | null;
  status: string;
}

// API URL from constants
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.kidsactivitytracker.ca';

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<CurrentSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeFeatureTab, setActiveFeatureTab] = useState<'priority' | 'analytics' | 'targeting'>('priority');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('vendor_token');

      // Fetch plans
      const plansResponse = await fetch(`${API_URL}/api/sponsor/plans`);
      const plansData = await plansResponse.json();
      if (plansData.success) {
        setPlans(plansData.plans);
      }

      // Fetch vendor profile to get subscription status
      const profileResponse = await getProfile();
      if (profileResponse.success && profileResponse.vendor) {
        setCurrentPlan({
          plan: profileResponse.vendor.plan || null,
          status: profileResponse.vendor.subscriptionStatus || 'free',
        });
      }
    } catch (err) {
      console.error('Failed to load plans');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) return;

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('vendor_token');
      const vendorId = localStorage.getItem('vendor_id');

      if (!vendorId) {
        throw new Error('Please log in again to continue');
      }

      const response = await fetch(`${API_URL}/api/vendor/${vendorId}/subscription/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          tier: selectedPlan.tier,
          billingCycle,
        }),
      });

      const result = await response.json();

      if (result.success && result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        throw new Error(result.error || 'Failed to create checkout session');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to start checkout. Please try again.');
      setIsSubmitting(false);
    }
  };

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      gold: 'from-yellow-400 to-yellow-600',
      silver: 'from-gray-300 to-gray-500',
      bronze: 'from-orange-400 to-orange-600',
    };
    return colors[tier] || 'from-[#FFB5C5] to-[#E8638B]';
  };

  const formatPrice = (price: string) => {
    const num = parseFloat(price);
    return num.toLocaleString('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E8638B]"></div>
      </div>
    );
  }

  const isFreeUser = !currentPlan?.plan;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Partner Plans</h1>
        <p className="text-gray-500 mt-1">
          Upgrade to a sponsor plan to boost your activities and reach more families
        </p>
      </div>

      {/* Current Plan Banner */}
      <div className={`rounded-xl p-6 mb-8 ${isFreeUser ? 'bg-gray-50 border border-gray-200' : 'bg-pink-50 border border-pink-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm font-medium ${isFreeUser ? 'text-gray-600' : 'text-[#E8638B]'}`}>Current Plan</p>
            <p className={`text-xl font-bold ${isFreeUser ? 'text-gray-900' : 'text-[#B8336B]'}`}>
              {currentPlan?.plan?.name || 'Free Partner'}
            </p>
            <p className={isFreeUser ? 'text-gray-600' : 'text-[#E8638B]'}>
              {isFreeUser ? 'Basic listing included' : currentPlan?.status}
            </p>
          </div>
          {currentPlan?.plan && (
            <span
              className={`px-4 py-2 bg-gradient-to-r ${getTierColor(currentPlan.plan.tier)} text-white rounded-full font-medium capitalize`}
            >
              {currentPlan.plan.tier}
            </span>
          )}
        </div>
      </div>

      {/* Why Upgrade Section */}
      {isFreeUser && (
        <div className="bg-gradient-to-r from-[#E8638B] to-[#D53F8C] rounded-2xl p-8 mb-8 text-white">
          <h2 className="text-2xl font-bold mb-4">Why Upgrade to Sponsor?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Priority Placement</h3>
                <p className="text-white/80 text-sm">Your activities appear first in search results</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Detailed Analytics</h3>
                <p className="text-white/80 text-sm">Track impressions, clicks, and engagement</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Geographic Targeting</h3>
                <p className="text-white/80 text-sm">Target specific cities and regions</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature Preview Section */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveFeatureTab('priority')}
              className={`flex-1 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeFeatureTab === 'priority'
                  ? 'border-[#E8638B] text-[#E8638B] bg-pink-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Priority Placement
            </button>
            <button
              onClick={() => setActiveFeatureTab('analytics')}
              className={`flex-1 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeFeatureTab === 'analytics'
                  ? 'border-[#E8638B] text-[#E8638B] bg-pink-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Analytics Dashboard
            </button>
            <button
              onClick={() => setActiveFeatureTab('targeting')}
              className={`flex-1 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeFeatureTab === 'targeting'
                  ? 'border-[#E8638B] text-[#E8638B] bg-pink-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Geographic Targeting
            </button>
          </div>
        </div>

        <div className="p-8">
          {activeFeatureTab === 'priority' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Get Seen First by Families</h3>
                <p className="text-gray-600 mb-4">
                  Sponsored activities appear at the top of search results with a highlighted badge,
                  ensuring maximum visibility when parents are searching for programs.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2 text-gray-700">
                    <CheckIcon className="text-green-500" />
                    &quot;Sponsored&quot; badge on your activities
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <CheckIcon className="text-green-500" />
                    Top placement in category search results
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <CheckIcon className="text-green-500" />
                    Priority listing in &quot;Near Me&quot; searches
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <CheckIcon className="text-green-500" />
                    Highlighted in browse and discovery sections
                  </li>
                </ul>
              </div>
              <div className="bg-gray-100 rounded-xl p-4">
                <div className="text-sm text-gray-500 mb-3 text-center">Your activity appears at the top of search results</div>
                <div className="flex gap-3 justify-center">
                  {/* Sponsored Activity Card */}
                  <div className="bg-white rounded-xl shadow-lg overflow-hidden w-[200px] flex-shrink-0">
                    <div className="relative h-24">
                      <img
                        src="/images/activities/swimming.jpg"
                        alt="Swimming activity"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 bg-pink-500 rounded-full">
                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-[10px] font-bold text-white">SPONSORED</span>
                      </div>
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-[#E8638B] rounded-full">
                        <span className="text-[10px] font-bold text-white">$150</span>
                      </div>
                    </div>
                    <div className="p-3">
                      <h4 className="font-semibold text-gray-900 text-sm">Your Swimming Academy</h4>
                      <div className="mt-1.5 space-y-1 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <span>📍</span>
                          <span>Vancouver Aquatic Centre</span>
                        </div>
                        <div className="flex items-center gap-1 text-pink-500 font-medium">
                          <span>🕐</span>
                          <span>9:00 - 10:30 AM</span>
                        </div>
                        <div className="flex items-center gap-1 text-green-600">
                          <span>✓</span>
                          <span>12 spots available</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Faded Regular Results */}
                  <div className="bg-white rounded-xl shadow overflow-hidden w-[160px] flex-shrink-0 opacity-50">
                    <div className="h-20 bg-gray-200"></div>
                    <div className="p-2">
                      <div className="h-3 bg-gray-200 rounded w-3/4 mb-1"></div>
                      <div className="h-2 bg-gray-100 rounded w-1/2"></div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow overflow-hidden w-[140px] flex-shrink-0 opacity-30 hidden xl:block">
                    <div className="h-20 bg-gray-200"></div>
                    <div className="p-2">
                      <div className="h-3 bg-gray-200 rounded w-3/4 mb-1"></div>
                      <div className="h-2 bg-gray-100 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeFeatureTab === 'analytics' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Understand Your Audience</h3>
                <p className="text-gray-600 mb-4">
                  Get detailed insights into how families are discovering and engaging with your activities.
                  Make data-driven decisions to maximize your reach.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2 text-gray-700">
                    <CheckIcon className="text-green-500" />
                    Real-time impression and click tracking
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <CheckIcon className="text-green-500" />
                    Click-through rate (CTR) optimization insights
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <CheckIcon className="text-green-500" />
                    Geographic breakdown of views
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <CheckIcon className="text-green-500" />
                    Activity-by-activity performance comparison
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <CheckIcon className="text-green-500" />
                    Trend analysis and historical data
                  </li>
                </ul>
              </div>
              <div className="bg-gray-100 rounded-xl p-4">
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Analytics Dashboard Preview</h4>
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-3 bg-pink-50 rounded-lg">
                      <div className="text-2xl font-bold text-[#E8638B]">12,458</div>
                      <div className="text-xs text-gray-500">Impressions</div>
                    </div>
                    <div className="text-center p-3 bg-pink-50 rounded-lg">
                      <div className="text-2xl font-bold text-pink-600">843</div>
                      <div className="text-xs text-gray-500">Clicks</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">6.8%</div>
                      <div className="text-xs text-gray-500">CTR</div>
                    </div>
                  </div>
                  {/* Chart mockup */}
                  <div className="h-32 bg-gradient-to-t from-pink-100 to-transparent rounded-lg flex items-end justify-around px-2 pb-2">
                    {[40, 55, 45, 70, 65, 80, 75].map((h, i) => (
                      <div
                        key={i}
                        className="w-6 bg-gradient-to-t from-[#E8638B] to-[#FFB5C5] rounded-t"
                        style={{ height: `${h}%` }}
                      ></div>
                    ))}
                  </div>
                  <div className="text-center text-xs text-gray-400 mt-2">Last 7 days</div>
                </div>
              </div>
            </div>
          )}

          {activeFeatureTab === 'targeting' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Reach the Right Families</h3>
                <p className="text-gray-600 mb-4">
                  Focus your visibility on specific cities and provinces where you operate.
                  Don&apos;t waste impressions on families outside your service area.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2 text-gray-700">
                    <CheckIcon className="text-green-500" />
                    Target specific cities where you offer programs
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <CheckIcon className="text-green-500" />
                    Province-wide targeting for regional businesses
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <CheckIcon className="text-green-500" />
                    Multi-location support
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <CheckIcon className="text-green-500" />
                    Adjust targeting anytime as you expand
                  </li>
                </ul>
              </div>
              <div className="bg-gray-100 rounded-xl p-4">
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Geographic Targeting</h4>
                  {/* Map mockup */}
                  <div className="relative h-48 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg mb-4 overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg className="w-32 h-32 text-blue-200" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                      </svg>
                    </div>
                    {/* City markers */}
                    <div className="absolute top-1/4 left-1/4 w-3 h-3 bg-[#E8638B] rounded-full animate-pulse"></div>
                    <div className="absolute top-1/3 left-1/2 w-3 h-3 bg-[#E8638B] rounded-full animate-pulse"></div>
                    <div className="absolute top-1/2 left-1/3 w-3 h-3 bg-[#E8638B] rounded-full animate-pulse"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Selected Cities:</span>
                      <span className="font-medium text-[#E8638B]">Vancouver, Burnaby, Richmond</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Province:</span>
                      <span className="font-medium text-[#E8638B]">British Columbia</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Plans Comparison Table */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Compare Plans</h2>
          <p className="text-gray-500">Choose the plan that fits your needs</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Feature</th>
                <th className="px-6 py-4 text-center text-sm font-medium text-gray-500">Free</th>
                <th className="px-6 py-4 text-center text-sm font-medium text-gray-500 bg-orange-50">Bronze</th>
                <th className="px-6 py-4 text-center text-sm font-medium text-gray-500 bg-gray-100">Silver</th>
                <th className="px-6 py-4 text-center text-sm font-medium text-gray-500 bg-yellow-50">Gold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 text-sm text-gray-700">Activity Listings</td>
                <td className="px-6 py-4 text-center"><CheckIcon className="mx-auto text-green-500" /></td>
                <td className="px-6 py-4 text-center bg-orange-50"><CheckIcon className="mx-auto text-green-500" /></td>
                <td className="px-6 py-4 text-center bg-gray-50"><CheckIcon className="mx-auto text-green-500" /></td>
                <td className="px-6 py-4 text-center bg-yellow-50"><CheckIcon className="mx-auto text-green-500" /></td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm text-gray-700">CSV/Excel Import</td>
                <td className="px-6 py-4 text-center"><CheckIcon className="mx-auto text-green-500" /></td>
                <td className="px-6 py-4 text-center bg-orange-50"><CheckIcon className="mx-auto text-green-500" /></td>
                <td className="px-6 py-4 text-center bg-gray-50"><CheckIcon className="mx-auto text-green-500" /></td>
                <td className="px-6 py-4 text-center bg-yellow-50"><CheckIcon className="mx-auto text-green-500" /></td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm text-gray-700">Priority Placement</td>
                <td className="px-6 py-4 text-center"><XIcon className="mx-auto text-gray-300" /></td>
                <td className="px-6 py-4 text-center bg-orange-50"><CheckIcon className="mx-auto text-green-500" /></td>
                <td className="px-6 py-4 text-center bg-gray-50"><CheckIcon className="mx-auto text-green-500" /></td>
                <td className="px-6 py-4 text-center bg-yellow-50"><CheckIcon className="mx-auto text-green-500" /></td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm text-gray-700">Sponsored Badge</td>
                <td className="px-6 py-4 text-center"><XIcon className="mx-auto text-gray-300" /></td>
                <td className="px-6 py-4 text-center bg-orange-50"><CheckIcon className="mx-auto text-green-500" /></td>
                <td className="px-6 py-4 text-center bg-gray-50"><CheckIcon className="mx-auto text-green-500" /></td>
                <td className="px-6 py-4 text-center bg-yellow-50"><CheckIcon className="mx-auto text-green-500" /></td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm text-gray-700">Analytics Dashboard</td>
                <td className="px-6 py-4 text-center"><XIcon className="mx-auto text-gray-300" /></td>
                <td className="px-6 py-4 text-center bg-orange-50"><CheckIcon className="mx-auto text-green-500" /></td>
                <td className="px-6 py-4 text-center bg-gray-50"><CheckIcon className="mx-auto text-green-500" /></td>
                <td className="px-6 py-4 text-center bg-yellow-50"><CheckIcon className="mx-auto text-green-500" /></td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm text-gray-700">Geographic Targeting</td>
                <td className="px-6 py-4 text-center"><XIcon className="mx-auto text-gray-300" /></td>
                <td className="px-6 py-4 text-center bg-orange-50"><XIcon className="mx-auto text-gray-300" /></td>
                <td className="px-6 py-4 text-center bg-gray-50"><CheckIcon className="mx-auto text-green-500" /></td>
                <td className="px-6 py-4 text-center bg-yellow-50"><CheckIcon className="mx-auto text-green-500" /></td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm text-gray-700">Monthly Impressions</td>
                <td className="px-6 py-4 text-center text-sm text-gray-500">Standard</td>
                <td className="px-6 py-4 text-center bg-orange-50 text-sm">5,000</td>
                <td className="px-6 py-4 text-center bg-gray-50 text-sm">25,000</td>
                <td className="px-6 py-4 text-center bg-yellow-50 text-sm">Unlimited</td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm text-gray-700 font-medium">Monthly Price</td>
                <td className="px-6 py-4 text-center text-lg font-bold text-gray-900">Free</td>
                <td className="px-6 py-4 text-center bg-orange-50 text-lg font-bold text-orange-600">$49</td>
                <td className="px-6 py-4 text-center bg-gray-50 text-lg font-bold text-gray-700">$99</td>
                <td className="px-6 py-4 text-center bg-yellow-50 text-lg font-bold text-yellow-600">$199</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {plans.map((plan) => {
          const isCurrentPlan = currentPlan?.plan?.id === plan.id;
          const features = plan.features as any;

          return (
            <div
              key={plan.id}
              className={`bg-white rounded-xl shadow-lg overflow-hidden flex flex-col ${
                isCurrentPlan ? 'ring-2 ring-[#E8638B]' : ''
              }`}
            >
              {/* Header */}
              <div
                className={`p-6 bg-gradient-to-r ${getTierColor(plan.tier)} text-white`}
              >
                <h2 className="text-2xl font-bold">{plan.name}</h2>
              </div>

              {/* Pricing */}
              <div className="p-6 border-b">
                <div className="flex items-baseline">
                  <span className="text-4xl font-bold text-gray-900">
                    {formatPrice(plan.monthlyPrice)}
                  </span>
                  <span className="text-gray-500 ml-2">/month</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  or {formatPrice(plan.yearlyPrice)}/year (save 2 months)
                </p>
              </div>

              {/* Features */}
              <div className="p-6 flex-grow">
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <CheckIcon className="text-green-500" />
                    <span>
                      {plan.impressionLimit
                        ? `${plan.impressionLimit.toLocaleString()} impressions/month`
                        : 'Unlimited impressions'}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon className="text-green-500" />
                    <span>Priority placement in search results</span>
                  </li>
                  {features?.analytics && (
                    <li className="flex items-center gap-2">
                      <CheckIcon className="text-green-500" />
                      <span>Advanced analytics dashboard</span>
                    </li>
                  )}
                  {features?.targeting && (
                    <li className="flex items-center gap-2">
                      <CheckIcon className="text-green-500" />
                      <span>Geographic targeting</span>
                    </li>
                  )}
                  {features?.badge && (
                    <li className="flex items-center gap-2">
                      <CheckIcon className="text-green-500" />
                      <span>Sponsored badge on activities</span>
                    </li>
                  )}
                </ul>
              </div>

              {/* Action */}
              <div className="p-6 pt-0">
                {isCurrentPlan ? (
                  <button
                    disabled
                    className="w-full py-3 bg-gray-100 text-gray-500 rounded-lg font-medium cursor-not-allowed"
                  >
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => setSelectedPlan(plan)}
                    className="w-full py-3 bg-gradient-to-r from-[#E8638B] to-[#D53F8C] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                  >
                    {currentPlan?.plan ? 'Upgrade' : 'Subscribe'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Subscribe Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Subscribe to {selectedPlan.name}
            </h3>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Billing Cycle
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={`p-3 border rounded-lg text-center transition-colors ${
                      billingCycle === 'monthly'
                        ? 'border-[#E8638B] bg-pink-50 text-[#D53F8C]'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="font-semibold">{formatPrice(selectedPlan.monthlyPrice)}</div>
                    <div className="text-sm text-gray-500">per month</div>
                  </button>
                  <button
                    onClick={() => setBillingCycle('annual')}
                    className={`p-3 border rounded-lg text-center transition-colors ${
                      billingCycle === 'annual'
                        ? 'border-[#E8638B] bg-pink-50 text-[#D53F8C]'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="font-semibold">{formatPrice(selectedPlan.yearlyPrice)}</div>
                    <div className="text-sm text-gray-500">per year</div>
                    <div className="text-xs text-green-600 font-medium">Save 2 months</div>
                  </button>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-6">
              You&apos;ll be redirected to our secure payment page to complete your subscription.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedPlan(null)}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubscribe}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-[#E8638B] to-[#D53F8C] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSubmitting ? 'Redirecting...' : 'Continue to Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {plans.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow">
          <p className="text-gray-500">No plans available at the moment.</p>
        </div>
      )}
    </div>
  );
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`w-5 h-5 flex-shrink-0 ${className}`} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function XIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`w-5 h-5 flex-shrink-0 ${className}`} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}
