import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CANONICAL_DOMAIN = 'kidsactivitytracker.ca';
const ALLOWED_HOSTS = [
  'kidsactivitytracker.ca',
  'www.kidsactivitytracker.ca',
  'localhost',
  '127.0.0.1',
];

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';

  // Check if this is a Cloud Run or other non-canonical URL
  const isAllowedHost = ALLOWED_HOSTS.some(allowed =>
    host === allowed || host.startsWith(`${allowed}:`)
  );

  if (!isAllowedHost) {
    // Redirect to canonical domain
    const url = new URL(request.url);
    url.host = CANONICAL_DOMAIN;
    url.protocol = 'https:';
    url.port = '';

    return NextResponse.redirect(url.toString(), 301);
  }

  return NextResponse.next();
}

export const config = {
  // Match all paths except static files and API routes
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images|.*\\.png|.*\\.jpg|.*\\.svg).*)',
  ],
};
