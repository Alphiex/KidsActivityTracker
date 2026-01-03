'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getProfile } from '@/lib/vendorApi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.kidsactivitytracker.ca';

interface SubscriptionDetails {
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  plan: string | null;
}

export default function BillingPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [planName, setPlanName] = useState<string>('Free');
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  useEffect(() => {
    fetchBillingInfo();
  }, []);

  const fetchBillingInfo = async () => {
    try {
      const response = await getProfile();
      if (response.success && response.vendor) {
        const isActive = response.vendor.subscriptionStatus === 'active';
        setIsSubscribed(isActive);
        setPlanName(response.vendor.plan?.name || 'Free Partner');

        if (isActive) {
          // Fetch subscription details from Stripe
          const token = localStorage.getItem('vendor_token');
          const subResponse = await fetch(`${API_URL}/api/vendor/subscription/details`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          const subData = await subResponse.json();
          if (subData.success) {
            setSubscription(subData.subscription);
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
      const response = await fetch(`${API_URL}/api/vendor/subscription/portal`, {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E8638B]"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Plans & Billing</h1>
        <p className="text-gray-500 mt-1">Manage your subscription and billing</p>
      </div>

      {/* Current Plan */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Current Plan</p>
            <p className="text-2xl font-bold text-gray-900">{planName}</p>
            {subscription && (
              <p className="text-sm text-gray-500 mt-1">
                {subscription.cancelAtPeriodEnd
                  ? `Cancels on ${new Date(subscription.currentPeriodEnd!).toLocaleDateString()}`
                  : subscription.currentPeriodEnd
                  ? `Renews on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                  : ''}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            {isSubscribed && (
              <button
                onClick={openCustomerPortal}
                disabled={isOpeningPortal}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {isOpeningPortal ? 'Opening...' : 'Manage Billing'}
              </button>
            )}
            <Link
              href="/vendor/dashboard/plans"
              className="px-4 py-2 bg-gradient-to-r from-[#E8638B] to-[#D53F8C] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              {isSubscribed ? 'Change Plan' : 'Upgrade'}
            </Link>
          </div>
        </div>
      </div>

      {/* Subscription Status */}
      {isSubscribed ? (
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscription Details</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-gray-600">Status</span>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium capitalize">
                {subscription?.status || 'Active'}
              </span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-gray-600">Plan</span>
              <span className="font-medium text-gray-900">{planName}</span>
            </div>
            {subscription?.currentPeriodEnd && (
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-gray-600">
                  {subscription.cancelAtPeriodEnd ? 'Ends On' : 'Next Billing Date'}
                </span>
                <span className="font-medium text-gray-900">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-CA', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}
            {subscription?.cancelAtPeriodEnd && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 text-sm">
                  Your subscription is set to cancel at the end of the current billing period.
                  You can reactivate it at any time before then.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
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
