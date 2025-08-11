import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const DAILY_LIMIT = parseInt(process.env.GLOBAL_DAILY_LIMIT);

async function checkUsageAvailability() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const key = `usage:${today}`;

  try {
    const currentUsage = (await redis.get(key)) ?? 0;
    const hasQueriesAvailable = Number(currentUsage) < DAILY_LIMIT;
    
    const resetTime = new Date();
    resetTime.setUTCDate(resetTime.getUTCDate() + 1);
    resetTime.setUTCHours(0, 0, 0, 0);

    return {
      hasQueriesAvailable,
      resetTime: resetTime.toISOString(),
      currentUsage: Number(currentUsage),
      dailyLimit: DAILY_LIMIT
    };
  } catch (error) {
    console.error('Redis error in usage check:', error);
    // If Redis is unavailable, assume queries are available
    return {
      hasQueriesAvailable: true,
      resetTime: null,
      currentUsage: 0,
      dailyLimit: DAILY_LIMIT
    };
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const usage = await checkUsageAvailability();
    res.status(200).json(usage);
  } catch (error) {
    console.error('Usage endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}