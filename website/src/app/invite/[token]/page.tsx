'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

interface InvitationData {
  id: string;
  sender: {
    name: string;
    email: string;
    children?: Array<{
      name: string;
      age: number;
      interests?: string[];
    }>;
  };
  status: string;
  message?: string;
  expiresAt: string;
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.kidsactivitytracker.ca';
const TOKEN_REGEX = /^[a-zA-Z0-9_-]+$/;

// Validate token format for security
function isValidToken(token: string): boolean {
  return TOKEN_REGEX.test(token) && token.length > 0 && token.length <= 128;
}

// Sanitize text to prevent XSS
function sanitizeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default function InvitationPage({ params }: { params: { token: string } }) {
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Validate token format
  const isTokenValid = useMemo(() => isValidToken(params.token), [params.token]);

  useEffect(() => {
    const fetchInvitation = async () => {
      // Validate token format before making request
      if (!isTokenValid) {
        setError('Invalid invitation link');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/api/invitations/preview/${encodeURIComponent(params.token)}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            setError('Invitation not found');
          } else {
            setError('Failed to load invitation');
          }
          setLoading(false);
          return;
        }

        const data = await response.json();

        if (data.success && data.invitation) {
          setInvitation(data.invitation);
          
          if (data.invitation.status === 'expired') {
            setError('This invitation has expired');
          } else if (data.invitation.status !== 'pending') {
            setError(`This invitation has already been ${data.invitation.status}`);
          }
        } else {
          setError(data.error || 'Invitation not found');
        }
      } catch (err) {
        console.error('Error fetching invitation:', err);
        setError('Failed to load invitation');
      } finally {
        setLoading(false);
      }
    };

    fetchInvitation();
  }, [params.token, isTokenValid]);

  const getExpiryText = () => {
    if (!invitation) return '';
    const expiryDate = new Date(invitation.expiresAt);
    const now = new Date();
    const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft <= 0) return 'Expired';
    if (daysLeft === 1) return 'Expires tomorrow';
    return `Expires in ${daysLeft} days`;
  };

  const appStoreUrl = 'https://apps.apple.com/app/kids-activity-tracker/id6478181275';
  const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.kidsactivitytracker.app';
  // Only generate deep link if token is valid
  const deepLink = isTokenValid ? `kidsactivitytracker://invite/${encodeURIComponent(params.token)}` : '#';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF5F8] to-[#FFE5EC] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF385C] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF5F8] to-[#FFE5EC] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Oops!</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link 
            href="/"
            className="inline-block bg-[#FF385C] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#E31C5F] transition"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF5F8] to-[#FFE5EC] py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-2xl font-bold text-[#FF385C]">Kids Activity Tracker</h1>
          </Link>
        </div>

        {/* Invitation Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Banner */}
          <div className="bg-gradient-to-r from-[#FF385C] to-[#E31C5F] py-6 px-8 text-white text-center">
            <h2 className="text-xl font-semibold">Activity Share Invitation</h2>
          </div>

          <div className="p-8">
            {/* Sender Info */}
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-[#FF385C] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{invitation?.sender.name}</h3>
              <p className="text-gray-500">{invitation?.sender.email}</p>
            </div>

            {/* Message */}
            <div className="text-center mb-6">
              <p className="text-gray-700 text-lg">
                wants to share their children&apos;s activities with you
              </p>
              
              {invitation?.message && (
                <div className="bg-gray-50 rounded-xl p-4 mt-4 text-left">
                  <p className="text-gray-600 italic">&ldquo;{invitation.message}&rdquo;</p>
                </div>
              )}
            </div>

            {/* Children */}
            {invitation?.sender.children && invitation.sender.children.length > 0 && (
              <div className="border-t border-gray-100 pt-6 mb-6">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Children</h4>
                <div className="space-y-3">
                  {invitation.sender.children.map((child, index) => (
                    <div key={index} className="flex items-center bg-gray-50 rounded-xl p-3">
                      <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center mr-3">
                        <svg className="w-5 h-5 text-[#E8638B]" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 3c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-2 18h4v-6h2.5l-2.5-4.5V7H10v3.5L7.5 15H10v6z"/>
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{child.name}</p>
                        <p className="text-sm text-gray-500">{child.age} years old</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Benefits */}
            <div className="border-t border-gray-100 pt-6 mb-6">
              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">By accepting, you&apos;ll be able to:</h4>
              <ul className="space-y-2">
                <li className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  View their children&apos;s activity schedules
                </li>
                <li className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  See upcoming activities and registrations
                </li>
                <li className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  Coordinate family activities together
                </li>
              </ul>
            </div>

            {/* Expiry */}
            <div className="text-center text-gray-500 text-sm mb-6">
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {getExpiryText()}
            </div>

            {/* CTA - Open in App */}
            <a
              href={deepLink}
              className="block w-full bg-[#FF385C] text-white text-center py-4 rounded-xl font-semibold text-lg hover:bg-[#E31C5F] transition mb-4"
            >
              Open in App
            </a>

            {/* Download Links */}
            <p className="text-center text-gray-500 mb-4">Don&apos;t have the app yet?</p>
            <div className="flex gap-4">
              <a
                href={appStoreUrl}
                className="flex-1 flex items-center justify-center bg-black text-white py-3 px-4 rounded-xl hover:bg-gray-800 transition"
              >
                <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                App Store
              </a>
              <a
                href={playStoreUrl}
                className="flex-1 flex items-center justify-center bg-black text-white py-3 px-4 rounded-xl hover:bg-gray-800 transition"
              >
                <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                </svg>
                Google Play
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>Kids Activity Tracker helps families discover and coordinate children&apos;s activities.</p>
          <div className="mt-2">
            <Link href="/privacy" className="hover:text-[#FF385C]">Privacy Policy</Link>
            <span className="mx-2">•</span>
            <Link href="/" className="hover:text-[#FF385C]">Learn More</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
