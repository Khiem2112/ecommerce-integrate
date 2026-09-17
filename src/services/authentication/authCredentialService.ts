import crypto from 'node:crypto';
import type { User } from '@prisma/client';
import { AUTH_CONFIG } from '@/config/authentication';
import { appLogger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import type { DbClient, RateLimitStatus } from '@/types';

// Pre-computed dummy scrypt hash with standard cost parameters (N=16384, r=8, p=1)
// Used for timing-safe dummy comparisons when an email does not exist or account is inactive
const DUMMY_SALT = '0123456789abcdef0123456789abcdef';
const DUMMY_HASH = `scrypt$16384$8$1$${DUMMY_SALT}$d9959e74360e22ecff31d8e13f9d554a6dbbb4a594ff9c3a3889151578351db8f8045610815da493033f2cff82173f4438ad4968c93437df1c96417d432ea700`;

export type AuthSecurityEvent =
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILED'
  | 'AUTH_PASSWORD_CHANGED'
  | 'AUTH_LOGOUT'
  | 'AUTH_SESSION_EXPIRED'
  | 'AUTH_SESSION_REVOKED'
  | 'AUTH_RATE_LIMITED';

export type LogAuthEventParams = {
  readonly event: AuthSecurityEvent;
  readonly userId?: number | null;
  readonly email?: string;
  readonly ip?: string;
  readonly userAgent?: string;
  readonly reason?: string;
  readonly correlationId?: string;
};

type AttemptRecord = {
  timestamps: number[];
};

// Global in-memory maps for tracking failed attempts without hitting the database
const ipAttempts = new Map<string, AttemptRecord>();
const accountAttempts = new Map<string, AttemptRecord>();

const MAX_TRACKED_ENTRIES = 5000;

/**
 * Standardize email addresses by trimming whitespace and converting to lowercase.
 */
export function canonicalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Anonymize or hash an IP address to preserve privacy while maintaining trace correlation.
 */
function hashIp(ip?: string): string | undefined {
  if (!ip) return undefined;
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

/**
 * Output structured security logs at application runtime.
 * Never logs raw passwords, plaintext session tokens, or sensitive payload data.
 */
export function logAuthSecurityEvent(params: LogAuthEventParams): void {
  const correlationId = params.correlationId ?? crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const payload = {
    category: 'SECURITY_AUTH',
    event: params.event,
    correlationId,
    timestamp,
    userId: params.userId ?? undefined,
    email: params.email ? canonicalizeEmail(params.email) : undefined,
    ipHash: hashIp(params.ip),
    userAgent: params.userAgent?.slice(0, 255),
    reason: params.reason,
  };

  if (params.event === 'AUTH_LOGIN_FAILED' || params.event === 'AUTH_RATE_LIMITED') {
    appLogger.warn(`[SECURITY] ${params.event}`, payload);
  } else {
    appLogger.info(`[SECURITY] ${params.event}`, payload);
  }
}

function pruneExpired(map: Map<string, AttemptRecord>, windowMs: number, now: number): void {
  if (map.size > MAX_TRACKED_ENTRIES) {
    for (const [key, record] of map.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);
      if (record.timestamps.length === 0) {
        map.delete(key);
      }
    }
  }
}

function getActiveTimestamps(
  map: Map<string, AttemptRecord>,
  key: string,
  windowMs: number,
  now: number,
): number[] {
  const record = map.get(key);
  if (!record) return [];
  const valid = record.timestamps.filter((ts) => now - ts < windowMs);
  if (valid.length === 0) {
    map.delete(key);
  } else {
    record.timestamps = valid;
  }
  return valid;
}

/**
 * Checks whether an incoming request from an IP / Account exceeds rate limit thresholds.
 */
export function checkRateLimit(ip: string, email?: string): RateLimitStatus {
  const now = Date.now();
  const windowMs = AUTH_CONFIG.RATE_LIMIT.WINDOW_MS;

  // Validate request rate against network IP threshold
  const ipHits = getActiveTimestamps(ipAttempts, ip, windowMs, now);
  if (ipHits.length >= AUTH_CONFIG.RATE_LIMIT.MAX_ATTEMPTS_PER_IP) {
    const oldest = ipHits[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  // Validate targeted login attempts against specific account credential threshold
  if (email) {
    const accountKey = `${ip}:${canonicalizeEmail(email)}`;
    const accountHits = getActiveTimestamps(accountAttempts, accountKey, windowMs, now);
    if (accountHits.length >= AUTH_CONFIG.RATE_LIMIT.MAX_ATTEMPTS_PER_ACCOUNT) {
      const oldest = accountHits[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      return { allowed: false, retryAfterSeconds };
    }
  }

  return { allowed: true };
}

/**
 * Records a failed login attempt against the IP and Account.
 */
export function recordFailedAttempt(ip: string, email?: string): RateLimitStatus {
  const now = Date.now();
  const windowMs = AUTH_CONFIG.RATE_LIMIT.WINDOW_MS;

  pruneExpired(ipAttempts, windowMs, now);
  pruneExpired(accountAttempts, windowMs, now);

  // Record failed attempt against origin IP address
  const ipRecord = ipAttempts.get(ip) ?? { timestamps: [] };
  ipRecord.timestamps.push(now);
  ipAttempts.set(ip, ipRecord);

  // Record failed attempt against target account identifier
  if (email) {
    const accountKey = `${ip}:${canonicalizeEmail(email)}`;
    const accountRecord = accountAttempts.get(accountKey) ?? { timestamps: [] };
    accountRecord.timestamps.push(now);
    accountAttempts.set(accountKey, accountRecord);
  }

  return checkRateLimit(ip, email);
}

/**
 * Resets the failed attempts upon successful login for the specific IP + Email.
 */
export function resetRateLimit(ip: string, email?: string): void {
  if (email) {
    const accountKey = `${ip}:${canonicalizeEmail(email)}`;
    accountAttempts.delete(accountKey);
  }
}

/**
 * Hash a password using node:crypto scrypt with cryptographically secure salt.
 * Produces an adaptive, memory-hard salted hash.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(`scrypt$16384$8$1$${salt}$${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Verify a plaintext password against a stored password hash in constant time.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') {
      return false;
    }

    const n = parseInt(parts[1], 10);
    const r = parseInt(parts[2], 10);
    const p = parseInt(parts[3], 10);
    const salt = parts[4];
    const expectedKeyHex = parts[5];
    const expectedKey = Buffer.from(expectedKeyHex, 'hex');

    return new Promise((resolve) => {
      crypto.scrypt(
        password,
        salt,
        expectedKey.length,
        { N: n, r: r, p: p },
        (err, derivedKey) => {
          if (err) {
            resolve(false);
            return;
          }
          if (derivedKey.length !== expectedKey.length) {
            resolve(false);
            return;
          }
          const match = crypto.timingSafeEqual(derivedKey, expectedKey);
          resolve(match);
        },
      );
    });
  } catch {
    return false;
  }
}

/**
 * Executes a dummy password verification with identical algorithmic cost
 * to protect against timing-based user enumeration attacks.
 */
export async function verifyDummyPassword(password: string): Promise<boolean> {
  await verifyPassword(password, DUMMY_HASH);
  return false;
}

/**
 * Verify user credentials against the database in a timing-safe manner.
 * If user is not found, inactive, or has no password set, dummy hash verification runs.
 */
export async function verifyUserCredentialsService(
  email: string,
  password: string,
  tx: DbClient = prisma,
): Promise<{ user: User } | null> {
  const normalizedEmail = canonicalizeEmail(email);

  const user = await tx.user.findFirst({
    where: {
      email: normalizedEmail,
      isActive: true,
    },
  });

  if (!user || !user.passwordHash) {
    // Run dummy calculation to equalize timing against timing enumeration
    await verifyDummyPassword(password);
    return null;
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  return { user };
}

/**
 * Validates a user's current password by user ID in a timing-safe manner.
 * Used for voluntary password changes without exposing raw DB queries to action layer.
 */
export async function verifyUserPasswordByIdService(
  userId: number,
  currentPassword: string,
  tx: DbClient = prisma,
): Promise<boolean> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user || !user.passwordHash) {
    await verifyDummyPassword(currentPassword);
    return false;
  }

  return await verifyPassword(currentPassword, user.passwordHash);
}

/**
 * Updates a user's password hash, clears or sets mustChangePassword flag,
 * and stamps passwordChangedAt.
 */
export async function updateUserPasswordService(
  userId: number,
  newPasswordHash: string,
  mustChangePassword = false,
  tx: DbClient = prisma,
): Promise<void> {
  await tx.user.update({
    where: { id: userId },
    data: {
      passwordHash: newPasswordHash,
      mustChangePassword,
      passwordChangedAt: new Date(),
    },
  });
}
