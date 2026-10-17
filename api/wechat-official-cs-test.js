// Manual, single-recipient Official Account customer-service news test.
// Does not run on publication and does not broadcast to stored OAuth identities.
// WeChat requires a valid customer-service interaction window for the recipient.
const TARGET = 'https://www.impactone.news/daily.html';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  const key = process.env.WECHAT_SEND_ADMIN_KEY;
  if (!key || req.headers.authorization !== `Bearer ${key}`) return res.status(401).json({error:'Unauthorized'});
  const {clientId, dryRun = true} = req.body || {};
  if (typeof clientId !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(clientId)) return res.status(400).json({error:'Valid bound clientId required'});
  const db = process.env.SUPABASE_URL;
  const dbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!db || !dbKey) return res.status(503).json({error:'Binding database not configured'});
  let openid;
  try {
    const lookup = await fetch(`${db.replace(/\\/$/,'')}/rest/v1/wechat_official_bindings?client_id=eq.${encodeURIComponent(clientId)}&select=official_openid&limit=1`, {
      headers:{apikey:dbKey,Authorization:`Bearer ${dbKey}`},
      signal:AbortSignal.timeout(10000)
    });
    if (!lookup.ok) return res.status(502).json({error:'Binding lookup failed'});
    const records = await lookup.json();
    openid = records[0]?.official_openid;
    if (!openid) return res.status(404).json({error:'No service account binding for clientId'});
  } catch { return res.status(502).json({error:'Binding lookup unavailable'}); }
  const payload = {touser:openid,msgtype:'news',news:{articles:[{title:'影响力·每日必读已更新',description:'点击查看最新一期日报',url:TARGET,picurl:''}]}};
  if (dryRun !== false) return res.status(200).json({ready:true,dryRun:true,msgtype:payload.msgtype,target:TARGET,recipient:'redacted',note:'No message sent'});
  const appid = process.env.WECHAT_OFFICIAL_ACCOUNT_APPID;
  const secret = process.env.WECHAT_OFFICIAL_ACCOUNT_APPSECRET;
  if (!appid || !secret) return res.status(503).json({error:'Service account credentials not configured'});
  try {
    const tokenUrl = new URL('https://api.weixin.qq.com/cgi-bin/token');
    tokenUrl.searchParams.set('grant_type','client_credential');
    tokenUrl.searchParams.set('appid',appid);
    tokenUrl.searchParams.set('secret',secret);
    const tokenResponse = await fetch(tokenUrl,{signal:AbortSignal.timeout(12000)});
    const token = await tokenResponse.json();
    if (!token.access_token) return res.status(502).json({error:'WeChat access token failed',wechat_errcode:token.errcode ?? null});
    const sendUrl = new URL('https://api.weixin.qq.com/cgi-bin/message/custom/send');
    sendUrl.searchParams.set('access_token',token.access_token);
    const response = await fetch(sendUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});
    const result = await response.json();
    return res.status(result.errcode === 0 ? 200 : 502).json({success:result.errcode===0,errcode:result.errcode,errmsg:result.errmsg,target:TARGET});
  } catch(e) {
    return res.status(502).json({error:'WeChat API request failed',detail:e instanceof Error ? e.message : 'Unknown error'});
  }
}
