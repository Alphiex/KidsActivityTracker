'use client';

import { useState, useEffect } from 'react';
import { sponsorApi, Plan } from '@/lib/sponsorApi';

interface CurrentSubscription {
  plan: Plan | null;
  status: string;
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<CurrentSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [plansRes, sponsorRes] = await Promise.all([
        sponsorApi.getPlans(),
        sponsorApi.getCurrentSponsor(),
      ]);

      if (plansRes.success) {
        setPlans(plansRes.plans);
      }

      if (sponsorRes.success) {
        setCurrentPlan({
          plan: sponsorRes.sponsor.plan,
          status: sponsorRes.sponsor.subscriptionStatus,
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
      // Create Stripe Checkout session and redirect
      const result = await sponsorApi.createCheckoutSession({
        tier: selectedPlan.tier as 'bronze' | 'silver' | 'gold',
        billingCycle,
      });

      if (result.success && result.checkoutUrl) {
        // Redirect to Stripe Checkout
        window.location.href = result.checkoutUrl;
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to start checkout');
      setIsSubmitting(false);
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
        <h1 className="text-2xl font-bold text-gray-900">Partner Plans</h1>
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
                    onClick={() => setSelectedPlan(plan)}
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

      {/* Success Message */}
      {successMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <CheckIcon />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Request Submitted!</h3>
              <p className="text-gray-600 mb-6">{successMessage}</p>
              <button
                onClick={() => setSuccessMessage(null)}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscribe Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4 w-full">
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
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
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
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
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
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
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
          <p className="text-gray-500 mt-2">Contact support for partnership options.</p>
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
          href="mailto:partners@kidsactivitytracker.com"
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
