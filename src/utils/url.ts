/**
 * Validates and sanitizes a return URL to prevent Open Redirect vulnerabilities.
 * Ensures the target is a same-origin relative path within the application.
 */
export function validateSafeReturnUrl(
  returnUrl?: string | null,
  fallback = '/conversations',
): string {
  if (!returnUrl || typeof returnUrl !== 'string') {
    return fallback;
  }

  const trimmed = returnUrl.trim();

  // Ensure path starts with a single leading slash and avoid protocol-relative or backslash paths
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return fallback;
  }

  // Reject schemes like javascript:, data:, https:
  if (trimmed.includes(':')) {
    return fallback;
  }

  // Disallow redirecting directly to authentication cycle pages to prevent infinite loops
  if (
    trimmed.startsWith('/login') ||
    trimmed.startsWith('/change-password') ||
    trimmed.startsWith('/select-organization') ||
    trimmed.startsWith('/no-active-membership')
  ) {
    return fallback;
  }

  return trimmed;
}
