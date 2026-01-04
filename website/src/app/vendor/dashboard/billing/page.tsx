'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getProfile } from '@/lib/vendorApi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.kidsactivitytracker.ca';

interface Plan {
  id: string;
  name: string;
  tier: string;
  monthlyPrice: string;
  yearlyPrice: string;
  impressionLimit: number | null;
  features: {
    priority?: string;
    analytics?: boolean;
    targeting?: boolean;
    badge?: string;
    citiesLimit?: number | null;
  };
}

interface SubscriptionDetails {
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  plan: string | null;
}

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [planName, setPlanName] = useState<string>('Free');
  const [planTier, setPlanTier] = useState<string | null>(null);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [changingTier, setChangingTier] = useState<string | null>(null);
  const [tierChangeResult, setTierChangeResult] = useState<{
    success: boolean;
    message: string;
    isUpgrade?: boolean;
  } | null>(null);
  const [showDowngradeOptions, setShowDowngradeOptions] = useState(false);

  useEffect(() => {
    // If redirected from Stripe with success, sync the subscription first
    if (searchParams.get('success') === 'true') {
      syncSubscription().then(() => {
        setShowSuccessMessage(true);
        // Clear the URL parameter
        window.history.replaceState({}, '', '/vendor/dashboard/billing');
        fetchBillingInfo();
      });
    } else {
      fetchBillingInfo();
    }
  }, [searchParams]);

  const syncSubscription = async () => {
    try {
      const token = localStorage.getItem('vendor_token');
      const vendorId = localStorage.getItem('vendor_id');
      if (!token || !vendorId) return;

      // Call sync endpoint to ensure subscription is activated
      const response = await fetch(`${API_URL}/api/vendor/${vendorId}/subscription/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (data.success) {
        console.log('Subscription synced:', data.subscription);
      }
    } catch (err) {
      console.error('Failed to sync subscription:', err);
    }
  };

  const fetchBillingInfo = async () => {
    try {
      const token = localStorage.getItem('vendor_token');
      const vendorId = localStorage.getItem('vendor_id');

      // Fetch all plans for upgrade comparison
      const plansResponse = await fetch(`${API_URL}/api/sponsor/plans`);
      const plansData = await plansResponse.json();
      if (plansData.success) {
        setAllPlans(plansData.plans);
      }

      // Fetch vendor profile
      const response = await getProfile();
      if (response.success && response.vendor) {
        const isActive = response.vendor.subscriptionStatus === 'active';
        setIsSubscribed(isActive);
        setPlanName(response.vendor.plan?.name || 'Free Partner');
        setPlanTier(response.vendor.plan?.tier || null);
        setCurrentPlan(response.vendor.plan || null);

        if (vendorId && token) {
          // Fetch subscription details
          const subResponse = await fetch(`${API_URL}/api/vendor/${vendorId}/subscription/details`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          const subData = await subResponse.json();
          if (subData.success) {
            setSubscription(subData.subscription);
            // Update status from subscription details
            if (subData.subscription?.status === 'active') {
              setIsSubscribed(true);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch billing info');
    } finally {
      setIsLoading(false);
    }
  };

  const openCustomerPortal = async () => {
    setIsOpeningPortal(true);
    try {
      const token = localStorage.getItem('vendor_token');
      const vendorId = localStorage.getItem('vendor_id');
      const response = await fetch(`${API_URL}/api/vendor/${vendorId}/subscription/portal`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success && data.portalUrl) {
        window.location.href = data.portalUrl;
      } else {
        throw new Error(data.error || 'Failed to open billing portal');
      }
    } catch (err: any) {
      alert(err.message);
      setIsOpeningPortal(false);
    }
  };

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      gold: 'from-yellow-400 to-yellow-600',
      silver: 'from-gray-300 to-gray-500',
      bronze: 'from-orange-400 to-orange-600',
    };
    return colors[tier] || 'from-gray-200 to-gray-400';
  };

  const getTierBgColor = (tier: string) => {
    const colors: Record<string, string> = {
      gold: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      silver: 'bg-gray-100 text-gray-800 border-gray-300',
      bronze: 'bg-orange-100 text-orange-800 border-orange-300',
    };
    return colors[tier] || 'bg-gray-100 text-gray-800';
  };

  const getUpgradePlans = () => {
    if (!planTier) return []; // No upgrades if we don't know current tier
    const tierOrder = ['bronze', 'silver', 'gold'];
    const currentIndex = tierOrder.indexOf(planTier);
    if (currentIndex === -1) return []; // Invalid tier
    return allPlans.filter(p => tierOrder.indexOf(p.tier) > currentIndex);
  };

  const getDowngradePlans = () => {
    if (!planTier) return [];
    const tierOrder = ['bronze', 'silver', 'gold'];
    const currentIndex = tierOrder.indexOf(planTier);
    if (currentIndex === -1) return []; // Invalid tier
    return allPlans.filter(p => tierOrder.indexOf(p.tier) < currentIndex);
  };

  const changeTier = async (newTier: string, isUpgrade: boolean) => {
    if (!confirm(isUpgrade
      ? `Upgrade to ${newTier.charAt(0).toUpperCase() + newTier.slice(1)}? You will be charged a prorated amount for the remainder of your billing period.`
      : `Downgrade to ${newTier.charAt(0).toUpperCase() + newTier.slice(1)}? Your current benefits will remain active until the end of your billing period.`
    )) {
      return;
    }

    setChangingTier(newTier);
    setTierChangeResult(null);

    try {
      const token = localStorage.getItem('vendor_token');
      const vendorId = localStorage.getItem('vendor_id');

      const response = await fetch(`${API_URL}/api/vendor/${vendorId}/subscription/change-tier`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newTier,
          billingCycle: 'monthly', // Default to monthly for now
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTierChangeResult({
          success: true,
          message: data.message,
          isUpgrade: data.isUpgrade,
        });
        // Refresh billing info after tier change
        fetchBillingInfo();
      } else {
        setTierChangeResult({
          success: false,
          message: data.error || 'Failed to change plan',
        });
      }
    } catch (err: any) {
      setTierChangeResult({
        success: false,
        message: err.message || 'Failed to change plan',
      });
    } finally {
      setChangingTier(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E8638B]"></div>
      </div>
    );
  }

  const upgradePlans = getUpgradePlans();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Plans & Billing</h1>
        <p className="text-gray-500 mt-1">Manage your subscription and billing</p>
      </div>

      {/* Success Message */}
      {showSuccessMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-full">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-green-800">Subscription Activated!</p>
            <p className="text-sm text-green-700">Thank you for subscribing. Your sponsored features are now active.</p>
          </div>
          <button
            onClick={() => setShowSuccessMessage(false)}
            className="ml-auto p-1 text-green-600 hover:text-green-800"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Current Plan Card */}
      {isSubscribed && planTier ? (
        <div className={`rounded-xl shadow-lg overflow-hidden mb-6`}>
          <div className={`p-6 bg-gradient-to-r ${getTierColor(planTier)} text-white`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">Current Plan</p>
                <p className="text-3xl font-bold">{planName}</p>
                {subscription?.currentPeriodEnd && (
                  <p className="text-white/80 text-sm mt-1">
                    {subscription.cancelAtPeriodEnd
                      ? `Access until ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                      : `Renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className="inline-block px-4 py-2 bg-white/20 backdrop-blur rounded-full text-white font-bold capitalize">
                  {planTier} Tier
                </span>
              </div>
            </div>
          </div>
          <div className="bg-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  Active
                </span>
                {currentPlan?.impressionLimit ? (
                  <span className="text-gray-600 text-sm">
                    {currentPlan.impressionLimit.toLocaleString()} impressions/month
                  </span>
                ) : (
                  <span className="text-gray-600 text-sm">Unlimited impressions</span>
                )}
              </div>
              <button
                onClick={openCustomerPortal}
                disabled={isOpeningPortal}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {isOpeningPortal ? 'Opening...' : 'Manage Billing'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Current Plan</p>
              <p className="text-2xl font-bold text-gray-900">Free Partner</p>
              <p className="text-sm text-gray-500 mt-1">Basic listing included</p>
            </div>
            <Link
              href="/vendor/dashboard/plans"
              className="px-4 py-2 bg-gradient-to-r from-[#E8638B] to-[#D53F8C] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Upgrade
            </Link>
          </div>
        </div>
      )}

      {/* Enabled Features */}
      {isSubscribed && currentPlan && (
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Enabled Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium text-green-800">Priority Placement</span>
              </div>
              <p className="text-sm text-green-700">Your activities appear first in search results</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium text-green-800">Analytics Dashboard</span>
              </div>
              <p className="text-sm text-green-700">Track impressions, clicks, and engagement</p>
            </div>
            <div className={`p-4 rounded-lg border ${currentPlan.features?.targeting ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {currentPlan.features?.targeting ? (
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )}
                <span className={`font-medium ${currentPlan.features?.targeting ? 'text-green-800' : 'text-gray-500'}`}>Geographic Targeting</span>
              </div>
              <p className={`text-sm ${currentPlan.features?.targeting ? 'text-green-700' : 'text-gray-500'}`}>
                {currentPlan.features?.targeting ? 'Target specific cities and regions' : 'Upgrade to Silver or Gold'}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium text-green-800">Sponsored Badge</span>
              </div>
              <p className="text-sm text-green-700">Stand out with a {currentPlan.features?.badge} badge</p>
            </div>
          </div>
        </div>
      )}

      {/* Tier Change Result Message */}
      {tierChangeResult && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
          tierChangeResult.success
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}>
          <div className={`p-2 rounded-full ${
            tierChangeResult.success ? 'bg-green-100' : 'bg-red-100'
          }`}>
            {tierChangeResult.success ? (
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <div>
            <p className={`font-medium ${tierChangeResult.success ? 'text-green-800' : 'text-red-800'}`}>
              {tierChangeResult.success ? (tierChangeResult.isUpgrade ? 'Plan Upgraded!' : 'Plan Change Scheduled') : 'Plan Change Failed'}
            </p>
            <p className={`text-sm ${tierChangeResult.success ? 'text-green-700' : 'text-red-700'}`}>
              {tierChangeResult.message}
            </p>
          </div>
          <button
            onClick={() => setTierChangeResult(null)}
            className={`ml-auto p-1 ${tierChangeResult.success ? 'text-green-600 hover:text-green-800' : 'text-red-600 hover:text-red-800'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Upgrade Options - Prominent display */}
      {isSubscribed && upgradePlans.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-green-100 rounded-lg">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Upgrade Your Plan</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Get more impressions and unlock additional features. Upgrades take effect immediately with a prorated charge.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upgradePlans.map((plan) => (
              <div key={plan.id} className={`relative p-5 rounded-xl border-2 transition-all hover:shadow-lg ${
                plan.tier === 'gold'
                  ? 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50'
                  : 'border-gray-200 bg-white hover:border-[#E8638B]'
              }`}>
                {plan.tier === 'gold' && (
                  <div className="absolute -top-3 left-4 px-3 py-1 bg-gradient-to-r from-yellow-400 to-amber-500 text-white text-xs font-bold rounded-full shadow-sm">
                    BEST VALUE
                  </div>
                )}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{plan.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {plan.impressionLimit ? `${plan.impressionLimit.toLocaleString()} impressions/mo` : 'Unlimited impressions'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">${plan.monthlyPrice}</p>
                    <p className="text-xs text-gray-500">/month</p>
                  </div>
                </div>
                <ul className="space-y-2 mb-4 text-sm">
                  {plan.features?.targeting && (
                    <li className="flex items-center gap-2 text-gray-700">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Geographic targeting ({plan.features.citiesLimit ? `${plan.features.citiesLimit} cities` : 'unlimited'})
                    </li>
                  )}
                  <li className="flex items-center gap-2 text-gray-700">
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {plan.features?.priority === 'top' ? 'Top priority placement' : 'High priority placement'}
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {plan.features?.badge} sponsor badge
                  </li>
                </ul>
                <button
                  onClick={() => changeTier(plan.tier, true)}
                  disabled={changingTier === plan.tier}
                  className={`block w-full py-2.5 text-center rounded-lg font-medium transition-all disabled:opacity-50 ${
                    plan.tier === 'gold'
                      ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white hover:from-yellow-500 hover:to-amber-600 shadow-md'
                      : 'bg-gradient-to-r from-[#E8638B] to-[#D53F8C] text-white hover:opacity-90'
                  }`}
                >
                  {changingTier === plan.tier ? 'Processing...' : `Upgrade to ${plan.name.replace(' Partner', '')}`}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Downgrade Option - Subtle, collapsed by default */}
      {isSubscribed && getDowngradePlans().length > 0 && (
        <div className="mb-6">
          {!showDowngradeOptions ? (
            <button
              onClick={() => setShowDowngradeOptions(true)}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Looking to switch to a different plan?
            </button>
          ) : (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-600">
                  Switch to a lower-tier plan. Changes take effect at the end of your current billing period.
                </p>
                <button
                  onClick={() => setShowDowngradeOptions(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                {getDowngradePlans().map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => changeTier(plan.tier, false)}
                    disabled={changingTier === plan.tier}
                    className="px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-white hover:border-gray-400 transition-colors disabled:opacity-50"
                  >
                    {changingTier === plan.tier ? 'Processing...' : `Switch to ${plan.name.replace(' Partner', '')} ($${plan.monthlyPrice}/mo)`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Non-subscriber CTA */}
      {!isSubscribed && (
        <div className="bg-gradient-to-r from-[#E8638B] to-[#D53F8C] rounded-xl p-8 text-white mb-6">
          <h2 className="text-2xl font-bold mb-4">Upgrade to Sponsor</h2>
          <p className="mb-6 text-white/90">
            Get priority placement, detailed analytics, and geographic targeting to reach more families.
          </p>
          <Link
            href="/vendor/dashboard/plans"
            className="inline-block px-6 py-3 bg-white text-[#E8638B] font-medium rounded-lg hover:bg-gray-100 transition-colors"
          >
            View Sponsor Plans
          </Link>
        </div>
      )}

      {/* Payment Methods - Only for subscribers */}
      {isSubscribed && (
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Payment Method</h2>
            <button
              onClick={openCustomerPortal}
              disabled={isOpeningPortal}
              className="text-sm text-[#E8638B] hover:text-[#D53F8C]"
            >
              Update
            </button>
          </div>
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <svg className="w-8 h-8 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">Manage via Stripe</p>
              <p className="text-sm text-gray-500">Click &quot;Update&quot; to manage your payment method in Stripe&apos;s secure portal</p>
            </div>
          </div>
        </div>
      )}

      {/* Billing History - Only for subscribers */}
      {isSubscribed && (
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Billing History</h2>
            <button
              onClick={openCustomerPortal}
              disabled={isOpeningPortal}
              className="text-sm text-[#E8638B] hover:text-[#D53F8C]"
            >
              View All Invoices
            </button>
          </div>
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>View your invoices and billing history in the Stripe portal</p>
            <button
              onClick={openCustomerPortal}
              disabled={isOpeningPortal}
              className="mt-4 px-4 py-2 text-[#E8638B] hover:text-[#D53F8C] font-medium"
            >
              Open Billing Portal
            </button>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="mt-6 bg-gray-50 rounded-xl p-6">
        <h3 className="font-medium text-gray-900 mb-2">Need Help?</h3>
        <p className="text-gray-600 text-sm mb-4">
          If you have questions about billing or need to make changes to your subscription,
          our team is here to help.
        </p>
        <a
          href="mailto:billing@kidsactivitytracker.ca"
          className="text-[#E8638B] hover:text-[#D53F8C] font-medium text-sm"
        >
          Contact Billing Support
        </a>
      </div>
    </div>
  );
}
