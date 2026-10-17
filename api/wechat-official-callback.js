import crypto from 'node:crypto';

const secretKey = () => process.env.WECHAT_OAUTH_STATE_SECRET;
const sign = value => crypto.createHmac('sha256', secretKey()).update(value).digest('hex');
const safeEqual = (a,b) => {const x=Buffer.from(a);const y=Buffer.from(b);return x.length===y.length && crypto.timingSafeEqual(x,y);};
const clearCookie = 'io_oauth=; HttpOnly; Secure; SameSite=Lax; Path=/api/wechat-official-callback; Max-Age=0';

export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Set-Cookie',clearCookie);
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  if (!secretKey()) return res.status(503).send('OAuth not configured');
  let data;
  try {
    const cookie = (req.headers.cookie || '').split(';').map(x=>x.trim()).find(x=>x.startsWith('io_oauth='));
    const token = decodeURIComponent(cookie.split('=').slice(1).join('='));
    const [payload,mac] = token.split('.');
    if (!payload || !mac || !safeEqual(mac,sign(payload))) throw new Error('Bad state');
    data = JSON.parse(Buffer.from(payload,'base64url').toString());
    if (Date.now()>data.expires || data.state !== req.query.state) throw new Error('Expired or mismatched state');
    const returnUrl = new URL(data.returnUrl);
    if (!['https://www.impactone.news','https://impactone.news'].includes(returnUrl.origin) || !returnUrl.pathname.startsWith('/daily')) throw new Error('Invalid return');
  } catch { return res.status(400).send('微信授权会话失效，请返回日报重新操作'); }
  const go = status => {const url=new URL(data.returnUrl);url.searchParams.set('wechat_bind',status);return res.redirect(302,url.toString());};
  if (typeof req.query.code !== 'string') return go('denied');
  const appid=process.env.WECHAT_OFFICIAL_ACCOUNT_APPID;
  const secret=process.env.WECHAT_OFFICIAL_ACCOUNT_APPSECRET;
  const db=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!appid || !secret || !db || !key) return go('configuration_error');
  try {
    const exchange=new URL('https://api.weixin.qq.com/sns/oauth2/access_token');
    exchange.searchParams.set('appid',appid);
    exchange.searchParams.set('secret',secret);
    exchange.searchParams.set('code',req.query.code);
    exchange.searchParams.set('grant_type','authorization_code');
    const oauth=await (await fetch(exchange,{signal:AbortSignal.timeout(10000)})).json();
    if (!oauth.openid || oauth.errcode) {console.error('Official OAuth failed',oauth.errcode);return go('oauth_error');}
    const response=await fetch(`${db.replace(/\/$/,'')}/rest/v1/wechat_official_bindings?on_conflict=client_id`,{
      method:'POST',
      headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify({client_id:data.clientId,official_openid:oauth.openid,updated_at:new Date().toISOString()}),
      signal:AbortSignal.timeout(10000)
    });
    if (!response.ok) {console.error('Official binding database error',response.status);return go('database_error');}
    return go('success');
  } catch(error) {console.error('Official binding failed',error.message);return go('server_error');}
}
