import crypto from 'node:crypto';

const ORIGINS = new Set(['https://www.impactone.news', 'https://impactone.news']);
const CALLBACK_URL = 'https://www.impactone.news/wechat-official-callback.html';
const secretKey = () => process.env.WECHAT_OAUTH_STATE_SECRET;
const sign = value => crypto.createHmac('sha256', secretKey()).update(value).digest('hex');

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(origin && ORIGINS.has(origin) ? 204 : 403).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  if (req.method === 'POST' && (!origin || !ORIGINS.has(origin))) return res.status(403).json({error:'Origin not allowed'});
  if (!secretKey() || !process.env.WECHAT_OFFICIAL_ACCOUNT_APPID) return res.status(503).json({error:'OAuth not configured'});
  const {client_id: clientId, return_url: returnUrl} = req.method === 'GET' ? (req.query || {}) : (req.body || {});
  if (typeof clientId !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(clientId)) return res.status(400).json({error:'Invalid client_id'});
  let url;
  try { url = new URL(returnUrl); } catch { return res.status(400).json({error:'Invalid return URL'}); }
  if (!ORIGINS.has(url.origin) || !url.pathname.startsWith('/daily')) return res.status(400).json({error:'Return URL not allowed'});
  const nonce = crypto.randomBytes(24).toString('hex');
  const state = crypto.randomBytes(16).toString('hex');
  const payload = Buffer.from(JSON.stringify({clientId, returnUrl:url.toString(), state, nonce, expires:Date.now()+600000})).toString('base64url');
  const token = `${payload}.${sign(payload)}`;
  res.setHeader('Set-Cookie', `io_oauth=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/api/wechat-official-callback; Max-Age=600`);
  const redirect = CALLBACK_URL;
  const authorize = new URL('https://open.weixin.qq.com/connect/oauth2/authorize');
  authorize.searchParams.set('appid', process.env.WECHAT_OFFICIAL_ACCOUNT_APPID);
  authorize.searchParams.set('redirect_uri', redirect);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('scope', 'snsapi_base');
  authorize.searchParams.set('state', state);
  if (req.method === 'GET') return res.redirect(302, authorize.toString()+'#wechat_redirect');
  return res.status(200).json({success:true, authorize_url:authorize.toString()+'#wechat_redirect'});
}
