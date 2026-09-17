import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasAuthCookie =
    request.cookies.has('authjs.session-token') ||
    request.cookies.has('__Secure-authjs.session-token');


  const segments = pathname.split('/').filter(Boolean);
  const locale = routing.locales.includes(segments[0] as 'vi' | 'en')
    ? segments[0]
    : routing.defaultLocale;
  const pathWithoutLocale = routing.locales.includes(segments[0] as 'vi' | 'en')
    ? '/' + segments.slice(1).join('/')
    : pathname;

  const isPublicAuthRoute =
    pathWithoutLocale === '/login' ||
    pathWithoutLocale === '/change-password' ||
    pathWithoutLocale === '/select-organization' ||
    pathWithoutLocale === '/no-active-membership';

  // Optimistic redirect for unauthenticated users accessing protected operational routes
  if (
    !hasAuthCookie &&
    !isPublicAuthRoute &&
    pathWithoutLocale !== '' &&
    pathWithoutLocale !== '/' &&
    !pathWithoutLocale.startsWith('/dev')
  ) {
    const returnUrl = encodeURIComponent(pathname);
    const loginUrl = new URL(`/${locale}/login?returnUrl=${returnUrl}`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
