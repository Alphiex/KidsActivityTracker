'use client';

import { useState, useEffect } from 'react';
import { sponsorApi, SponsorInfo } from '@/lib/sponsorApi';

interface BillingInfo {
  sponsor: SponsorInfo;
}

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ billingEmail: '', billingName: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  useEffect(() => {
    fetchBilling();
  }, []);

  const fetchBilling = async () => {
    try {
      const response = await sponsorApi.getCurrentSponsor();
      if (response.success) {
        setBilling({ sponsor: response.sponsor });
        setEditForm({
          billingEmail: response.sponsor.billingEmail,
          billingName: response.sponsor.billingName || '',
        });
      }
    } catch (err) {
      console.error('Failed to load billing info');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateBilling = async () => {
    setIsSaving(true);
    try {
      const result = await sponsorApi.updateBilling({
        billingEmail: editForm.billingEmail,
        billingName: editForm.billingName || undefined,
      });

      if (result.success && billing) {
        setBilling({
          sponsor: {
            ...billing.sponsor,
            billingEmail: result.billing.billingEmail,
            billingName: result.billing.billingName,
          },
        });
        setShowEditModal(false);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update billing info');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? Your benefits will remain active until the end of your billing period.')) {
      return;
    }

    setIsCancelling(true);
    try {
      const result = await sponsorApi.cancelSubscription();

      if (result.success && billing) {
        setBilling({
          sponsor: {
            ...billing.sponsor,
            subscriptionStatus: result.subscription.status,
            subscriptionEndDate: result.subscription.endDate,
          },
        });
        alert(result.message);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to cancel subscription');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsLoadingPortal(true);
    try {
      const result = await sponsorApi.getCustomerPortal();
      if (result.success && result.portalUrl) {
        window.location.href = result.portalUrl;
      }
    } catch (err: any) {
      alert(err.message || 'Failed to open subscription management');
      setIsLoadingPortal(false);
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
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
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
            {sponsor.subscriptionStatus === 'active' && (
              <button
                onClick={handleManageSubscription}
                disabled={isLoadingPortal}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {isLoadingPortal ? 'Loading...' : 'Manage Subscription'}
              </button>
            )}
          </>
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
            onClick={() => setShowEditModal(true)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Update Billing Info
          </button>
        </div>
      </div>

      {/* Edit Billing Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4 w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Update Billing Information
            </h3>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Billing Email
                </label>
                <input
                  type="email"
                  value={editForm.billingEmail}
                  onChange={(e) => setEditForm({ ...editForm, billingEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Billing Name
                </label>
                <input
                  type="text"
                  value={editForm.billingName}
                  onChange={(e) => setEditForm({ ...editForm, billingName: e.target.value })}
                  placeholder="Company or individual name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                disabled={isSaving}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateBilling}
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment History */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment History</h2>
        {sponsor?.subscriptionStatus === 'active' ? (
          <div className="text-center py-6">
            <p className="text-gray-600 mb-4">
              View your complete payment history and download invoices through the Stripe Customer Portal.
            </p>
            <button
              onClick={handleManageSubscription}
              disabled={isLoadingPortal}
              className="inline-block px-6 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50"
            >
              {isLoadingPortal ? 'Loading...' : 'View Payment History'}
            </button>
          </div>
        ) : (
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
            <p>Payment history will appear here once you subscribe.</p>
          </div>
        )}
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
            onClick={handleCancelSubscription}
            disabled={isCancelling}
            className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {isCancelling ? 'Cancelling...' : 'Cancel Subscription'}
          </button>
        </div>
      )}
    </div>
  );
}
