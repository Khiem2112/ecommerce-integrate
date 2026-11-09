import Redis, { type RedisOptions } from 'ioredis';
import { appLogger } from './logger';

const globalForRedis = globalThis as unknown as {
  redisClient: Redis | undefined;
  redisSubscriber: Redis | undefined;
};

function resolveRedisOptions(): RedisOptions {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    return {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    };
  }

  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = Number(process.env.REDIS_PORT || 6379);
  const password = process.env.REDIS_PASSWORD || undefined;

  return {
    host,
    port,
    password,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  };
}

function createRedisClient(role: 'primary' | 'subscriber'): Redis {
  const redisUrl = process.env.REDIS_URL;
  const options = resolveRedisOptions();

  const client = redisUrl ? new Redis(redisUrl, options) : new Redis(options);

  client.on('error', (error: unknown) => {
    appLogger.error(`Redis ${role} connection error:`, error);
  });

  client.on('connect', () => {
    appLogger.info(`Redis ${role} connected successfully`);
  });

  return client;
}

export const redis: Redis =
  globalForRedis.redisClient ?? createRedisClient('primary');

export const redisSubscriber: Redis =
  globalForRedis.redisSubscriber ?? createRedisClient('subscriber');

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redisClient = redis;
  globalForRedis.redisSubscriber = redisSubscriber;
}

export function getRedisClient(): Redis {
  return redis;
}

export function getRedisSubscriber(): Redis {
  return redisSubscriber;
}

