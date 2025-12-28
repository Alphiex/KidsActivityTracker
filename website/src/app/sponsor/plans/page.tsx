'use client';

import { useState, useEffect } from 'react';

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

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<CurrentSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('sponsor_token');

      const [plansRes, sponsorRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sponsor/plans`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sponsor/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (plansRes.ok) {
        const data = await plansRes.json();
        setPlans(data.plans);
      }

      if (sponsorRes.ok) {
        const data = await sponsorRes.json();
        setCurrentPlan({
          plan: data.sponsor.plan,
          status: data.sponsor.subscriptionStatus,
        });
      }
    } catch (err) {
      console.error('Failed to load plans');
    } finally {
      setIsLoading(false);
    }
  };

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      gold: 'from-yellow-400 to-yellow-600',
      silver: 'from-gray-300 to-gray-500',
      bronze: 'from-orange-400 to-orange-600',
    };
    return colors[tier] || 'from-purple-400 to-purple-600';
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sponsor Plans</h1>
        <p className="text-gray-500 mt-1">
          Choose the plan that works best for your business
        </p>
      </div>

      {/* Current Plan Banner */}
      {currentPlan?.plan && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600 font-medium">Current Plan</p>
              <p className="text-xl font-bold text-purple-900">
                {currentPlan.plan.name}
              </p>
              <p className="text-purple-600 capitalize">{currentPlan.status}</p>
            </div>
            <span
              className={`px-4 py-2 bg-gradient-to-r ${getTierColor(currentPlan.plan.tier)} text-white rounded-full font-medium capitalize`}
            >
              {currentPlan.plan.tier}
            </span>
          </div>
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrentPlan = currentPlan?.plan?.id === plan.id;
          const features = plan.features as any;

          return (
            <div
              key={plan.id}
              className={`bg-white rounded-xl shadow-lg overflow-hidden ${
                isCurrentPlan ? 'ring-2 ring-purple-500' : ''
              }`}
            >
              {/* Header */}
              <div
                className={`p-6 bg-gradient-to-r ${getTierColor(plan.tier)} text-white`}
              >
                <h2 className="text-2xl font-bold">{plan.name}</h2>
                <p className="text-white/80 capitalize">{plan.tier} Tier</p>
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
              <div className="p-6">
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <CheckIcon />
                    <span>
                      {plan.impressionLimit
                        ? `${plan.impressionLimit.toLocaleString()} impressions/month`
                        : 'Unlimited impressions'}
                    </span>
                  </li>
                  {features?.priority && (
                    <li className="flex items-center gap-2">
                      <CheckIcon />
                      <span>Priority placement in search results</span>
                    </li>
                  )}
                  {features?.analytics && (
                    <li className="flex items-center gap-2">
                      <CheckIcon />
                      <span>Advanced analytics dashboard</span>
                    </li>
                  )}
                  {features?.targeting && (
                    <li className="flex items-center gap-2">
                      <CheckIcon />
                      <span>Geographic targeting</span>
                    </li>
                  )}
                  {features?.badge && (
                    <li className="flex items-center gap-2">
                      <CheckIcon />
                      <span>{features.badge} badge on activities</span>
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
                    onClick={() => {
                      // TODO: Integrate with RevenueCat
                      alert('Contact support to upgrade your plan');
                    }}
                    className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                  >
                    {currentPlan?.plan ? 'Upgrade' : 'Subscribe'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {plans.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow">
          <p className="text-gray-500">No plans available at the moment.</p>
          <p className="text-gray-500 mt-2">Contact support for sponsorship options.</p>
        </div>
      )}

      {/* Contact Section */}
      <div className="mt-8 bg-white rounded-xl shadow p-6 text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Need a custom plan?
        </h3>
        <p className="text-gray-500 mb-4">
          Contact us for enterprise pricing and custom features
        </p>
        <a
          href="mailto:sponsors@kidsactivitytracker.com"
          className="inline-block px-6 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors"
        >
          Contact Sales
        </a>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}
