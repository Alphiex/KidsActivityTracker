'use client';

import { useState, useEffect } from 'react';

interface BillingInfo {
  sponsor: {
    billingEmail: string;
    billingName: string | null;
    subscriptionStatus: string;
    subscriptionStartDate: string | null;
    subscriptionEndDate: string | null;
    plan: {
      name: string;
      tier: string;
      monthlyPrice: string;
    } | null;
  };
}

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchBilling();
  }, []);

  const fetchBilling = async () => {
    try {
      const token = localStorage.getItem('sponsor_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/sponsor/auth/me`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBilling(data);
      }
    } catch (err) {
      console.error('Failed to load billing info');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: string) => {
    const num = parseFloat(price);
    return num.toLocaleString('en-CA', {
      style: 'currency',
      currency: 'CAD',
    });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      past_due: 'bg-yellow-100 text-yellow-800',
      inactive: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`px-3 py-1 text-sm font-medium rounded-full ${colors[status] || colors.inactive}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const sponsor = billing?.sponsor;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-gray-500 mt-1">
          Manage your subscription and billing details
        </p>
      </div>

      {/* Subscription Overview */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Subscription</h2>
          {sponsor && getStatusBadge(sponsor.subscriptionStatus)}
        </div>

        {sponsor?.plan ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-500">Current Plan</p>
              <p className="text-xl font-bold text-gray-900">{sponsor.plan.name}</p>
              <p className="text-gray-600 capitalize">{sponsor.plan.tier} Tier</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Monthly Rate</p>
              <p className="text-xl font-bold text-gray-900">
                {formatPrice(sponsor.plan.monthlyPrice)}
              </p>
            </div>
            <div>
              {sponsor.subscriptionEndDate ? (
                <>
                  <p className="text-sm text-gray-500">
                    {sponsor.subscriptionStatus === 'cancelled' ? 'Ends On' : 'Renews On'}
                  </p>
                  <p className="text-xl font-bold text-gray-900">
                    {new Date(sponsor.subscriptionEndDate).toLocaleDateString()}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-500">Started On</p>
                  <p className="text-xl font-bold text-gray-900">
                    {sponsor.subscriptionStartDate
                      ? new Date(sponsor.subscriptionStartDate).toLocaleDateString()
                      : '-'}
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-gray-500 mb-4">No active subscription</p>
            <a
              href="/sponsor/plans"
              className="inline-block px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              View Plans
            </a>
          </div>
        )}
      </div>

      {/* Billing Details */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Billing Details</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">Billing Email</p>
            <p className="text-gray-900">{sponsor?.billingEmail || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Billing Name</p>
            <p className="text-gray-900">{sponsor?.billingName || '-'}</p>
          </div>
        </div>
        <div className="mt-6">
          <button
            onClick={() => {
              // TODO: Open edit billing modal
              alert('Contact support to update billing details');
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Update Billing Info
          </button>
        </div>
      </div>

      {/* Payment History Placeholder */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment History</h2>
        <div className="text-center py-8 text-gray-500">
          <svg
            className="w-12 h-12 mx-auto mb-4 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z"
            />
          </svg>
          <p>Payment history will appear here once billing is connected.</p>
          <p className="text-sm mt-2">
            Billing is managed through RevenueCat.
          </p>
        </div>
      </div>

      {/* Cancel Subscription */}
      {sponsor?.plan && sponsor.subscriptionStatus === 'active' && (
        <div className="mt-6 p-6 bg-gray-50 rounded-xl border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Cancel Subscription
          </h3>
          <p className="text-gray-500 mb-4">
            If you cancel, your sponsorship will remain active until the end of your billing period.
          </p>
          <button
            onClick={() => {
              if (confirm('Are you sure you want to cancel your subscription?')) {
                // TODO: Call cancel API
                alert('Contact support to cancel your subscription');
              }
            }}
            className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            Cancel Subscription
          </button>
        </div>
      )}
    </div>
  );
}
