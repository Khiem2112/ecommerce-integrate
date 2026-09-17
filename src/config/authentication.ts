/**
 * Authentication & Session Configuration (Server-Only)
 */

export const AUTH_CONFIG = {
  /** NextAuth Session cookie name */
  NEXTAUTH_COOKIE_NAME:
    process.env.NODE_ENV === 'production'
      ? '__Secure-authjs.session-token'
      : 'authjs.session-token',

  /** Active Organization Tenant Context cookie name */
  ACTIVE_ORG_COOKIE_NAME: 'omnicart_active_org',

  /** Active Organization cookie configuration */
  ACTIVE_ORG_COOKIE_OPTIONS: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  /** Rate limiting parameters (in-memory) */
  RATE_LIMIT: {
    MAX_ATTEMPTS_PER_IP: 10,
    MAX_ATTEMPTS_PER_ACCOUNT: 5,
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  },

  /** Password validation limits */
  PASSWORD_POLICY: {
    MIN_LENGTH: 6,
    MAX_LENGTH: 128,
  },
} as const;

