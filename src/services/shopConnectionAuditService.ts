/**
 * Shop Connection Audit Service.
 * Records immutable, append-only lifecycle audit events for shop connections and authorization attempts.
 * Enforces automatic redaction of sensitive credentials and tokens.
 */

import type { DbClient, PlatformConnectionStatusCode } from '@/types';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export type AppendShopConnectionAuditInput = {
  readonly connectionId?: number | null;
  readonly authorizationAttemptId?: number | null;
  readonly actorUserId?: number | null;
  readonly organizationIdBefore?: number | null;
  readonly organizationIdAfter?: number | null;
  readonly action: string;
  readonly fromStatus?: PlatformConnectionStatusCode | null;
  readonly toStatus?: PlatformConnectionStatusCode | null;
  readonly metadata?: Record<string, unknown> | null;
};

const SENSITIVE_KEYS = new Set([
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'password',
  'code',
  'appsecret',
  'statenonce',
  'authorizationcode',
]);

/**
 * Recursively redacts sensitive keys from audit metadata objects.
 */
function redactAuditMetadata(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(redactAuditMetadata);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = k.toLowerCase().replace(/[^a-z]/g, '');
    if (SENSITIVE_KEYS.has(lowerKey)) {
      sanitized[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      sanitized[k] = redactAuditMetadata(v);
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

/**
 * Appends a redacted audit event into `platform_connection_audit_log`.
 */
export async function appendShopConnectionAuditService(
  input: AppendShopConnectionAuditInput,
  tx: DbClient = prisma,
): Promise<void> {
  const sanitizedMetadata = input.metadata
    ? (redactAuditMetadata(input.metadata) as Prisma.InputJsonValue)
    : Prisma.JsonNull;

  await tx.platformConnectionAuditLog.create({
    data: {
      connectionId: input.connectionId ?? null,
      authorizationAttemptId: input.authorizationAttemptId ?? null,
      actorUserId: input.actorUserId ?? null,
      organizationIdBefore: input.organizationIdBefore ?? null,
      organizationIdAfter: input.organizationIdAfter ?? null,
      action: input.action,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      metadata: sanitizedMetadata,
    },
  });
}
