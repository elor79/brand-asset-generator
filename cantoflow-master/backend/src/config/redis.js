import { createClient } from 'redis';

let redisClient = null;

export async function connectRedis() {
  try {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';

    redisClient = createClient({
      url,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: () => false, // Disable reconnection attempts
      },
    });

    // Only log once, don't spam errors
    let errorLogged = false;
    redisClient.on('error', (err) => {
      if (!errorLogged) {
        console.warn('Redis not available, continuing without cache');
        errorLogged = true;
      }
    });

    await redisClient.connect();
    console.log('✓ Redis connected');
    return redisClient;
  } catch (error) {
    // Don't throw - Redis is optional for basic functionality
    console.warn('⚠ Running without Redis cache');
    return null;
  }
}

export function getRedisClient() {
  return redisClient;
}

export default redisClient;
