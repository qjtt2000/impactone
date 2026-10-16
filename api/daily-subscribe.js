
/*
 * IMPACTONE 网站订阅 API
 * 文件位置：/api/daily-subscribe.js
 *
 * POST /api/daily-subscribe
 *
 * 请求：
 * {
 *   "client_id": "浏览器生成的 UUID",
 *   "subscribed": true
 * }
 *
 * subscribed:
 * true  = 订阅
 * false = 取消订阅
 *
 * 仅用于网站订阅记录。
 * 不发送微信消息。
 */

const ALLOWED_ORIGINS = new Set([
  'https://impactone.news',
  'https://www.impactone.news',
  'https://impactone-gamma.vercel.app'
]);

export default async function handler(req, res) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type'
  );
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return res.status(403).json({
        success: false,
        error: 'Origin not allowed'
      });
    }

    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({
      success: false,
      error: 'Origin not allowed'
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase configuration');

    return res.status(503).json({
      success: false,
      error: 'Subscription service not configured'
    });
  }

  const body =
    typeof req.body === 'string'
      ? (() => {
          try {
            return JSON.parse(req.body);
          } catch {
            return null;
          }
        })()
      : req.body;

  const clientId = body?.client_id;
  const subscribed = body?.subscribed;

  if (
    typeof clientId !== 'string' ||
    !/^[a-zA-Z0-9_-]{8,100}$/.test(clientId) ||
    typeof subscribed !== 'boolean'
  ) {
    return res.status(400).json({
      success: false,
      error: 'Invalid subscription data'
    });
  }

  try {
    const endpoint =
      `${supabaseUrl.replace(/\/$/, '')}` +
      '/rest/v1/daily_subscriptions' +
      '?on_conflict=client_id';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({
        client_id: clientId,
        subscribed,
        source: 'website',
        updated_at: new Date().toISOString()
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const details = await response.text();

      console.error(
        'Supabase subscription error:',
        response.status,
        details
      );

      return res.status(502).json({
        success: false,
        error: 'Database write failed'
      });
    }

    return res.status(200).json({
      success: true,
      subscribed
    });
  } catch (error) {
    console.error('Subscription API error:', error);

    return res.status(500).json({
      success: false,
      error: 'Subscription service unavailable'
    });
  }
}
