/**
 * Email utility functions for canonical normalization and formatting.
 * Pure, stateless functions only.
 */

/**
 * Standardize email addresses by trimming whitespace, normalizing Unicode, and converting to lowercase.
 */
export function canonicalizeEmail(email: string): string {
  return email.trim().normalize('NFKC').toLowerCase();
}
