import crypto from 'crypto';
import { redis } from './redis';
import { appLogger } from './logger';

export type LockHandle = {
  resource: string;
  lockKey: string;
  lockValue: string;
  ttlMs: number;
  acquiredAt: number;
};

export type AcquireLockResult = {
  acquired: boolean;
  lock?: LockHandle;
  error?: string;
};

const RELEASE_LOCK_LUA_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export async function acquireLock(
  resource: string,
  ttlMs: number = 10000,
): Promise<AcquireLockResult> {
  const lockKey = `lock:${resource}`;
  const lockValue = crypto.randomUUID();

  try {
    const result = await redis.set(lockKey, lockValue, 'PX', ttlMs, 'NX');
    if (result === 'OK') {
      return {
        acquired: true,
        lock: {
          resource,
          lockKey,
          lockValue,
          ttlMs,
          acquiredAt: Date.now(),
        },
      };
    }

    return {
      acquired: false,
    };
  } catch (error) {
    appLogger.error(`Failed to acquire distributed lock for resource: ${resource}`, error);
    return {
      acquired: false,
      error: error instanceof Error ? error.message : 'Unknown lock acquisition error',
    };
  }
}

export async function releaseLock(lock: LockHandle): Promise<boolean> {
  try {
    const result = await redis.eval(
      RELEASE_LOCK_LUA_SCRIPT,
      1,
      lock.lockKey,
      lock.lockValue,
    );
    return result === 1;
  } catch (error) {
    appLogger.error(`Failed to release distributed lock for resource: ${lock.resource}`, error);
    return false;
  }
}

export async function withDistributedLock<T>(
  resource: string,
  ttlMs: number,
  task: () => Promise<T>,
): Promise<T | null> {
  const lockResult = await acquireLock(resource, ttlMs);
  if (!lockResult.acquired || !lockResult.lock) {
    return null;
  }

  try {
    return await task();
  } finally {
    await releaseLock(lockResult.lock);
  }
}
