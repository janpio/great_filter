import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const DAILY_LIMIT = parseInt(process.env.GLOBAL_DAILY_LIMIT);

async function checkAndIncrementUsage(postCount) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const key = `usage:${today}`;

  try {
    const currentUsage = (await redis.get(key)) ?? 0;
    const newUsage = Number(currentUsage) + Number(postCount);

    console.log(`📊 Redis Debug: key=${key}, currentUsage=${currentUsage}, postCount=${postCount}, newUsage=${newUsage}`);

    if (newUsage > DAILY_LIMIT) {
      return false;
    }

    await redis.set(key, newUsage);
    return true;
  } catch (error) {
    console.error('Redis error:', error);
    return true;
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenRouter API key not configured' });
    }

    // Extract post count from request body
    const postCount = req.body.postCount || 1;

    // Check daily usage limit
    const usageAllowed = await checkAndIncrementUsage(postCount);

    if (!usageAllowed) {
      return res.status(429).json({ error: 'Daily limit exceeded' });
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: `OpenRouter API error: ${response.status} ${response.statusText}`,
        details: errorText
      });
    }

    const data = await response.json();
    res.status(200).json(data);

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}