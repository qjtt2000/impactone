import { timingSafeEqual, createHash } from 'node:crypto';
import { list } from '@vercel/blob';

const digest = (value) => createHash('sha256').update(value).digest();
const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
});
const record = /^daily-listens\/(\d{4}-\d{2}-\d{2})(-ny)?\/(\d{4}-\d{2}-\d{2})\/[0-9a-f-]{36}\.txt$/i;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }
  const password = process.env.DAILY_LISTEN_REPORT_PASSWORD;
  if (!password) return res.status(503).send('收听汇总暂不可用。');

  const authorization = req.headers.authorization || '';
  const supplied = authorization.startsWith('Basic ')
    ? Buffer.from(authorization.slice(6), 'base64').toString('utf8')
    : '';
  if (!timingSafeEqual(digest(supplied), digest('impactone:' + password))) {
    res.setHeader('WWW-Authenticate', 'Basic realm="IMPACTONE Listening", charset="UTF-8"');
    return res.status(401).send('请登录查看收听汇总。');
  }

  const counts = new Map();
  let cursor;
  try {
    do {
      const page = await list({ prefix: 'daily-listens/', limit: 1000, cursor });
      for (const blob of page.blobs) {
        const match = record.exec(blob.pathname);
        if (!match) continue;
        const [, issue, local, day] = match;
        const key = day + '/' + issue;
        const row = counts.get(key) || { issue, day, global: 0, ny: 0 };
        row[local ? 'ny' : 'global']++;
        counts.set(key, row);
      }
      if (!page.hasMore) break;
      if (!page.cursor || page.cursor === cursor) throw new Error('Unable to paginate listening records');
      cursor = page.cursor;
    } while (cursor);
  } catch {
    return res.status(503).send('暂时无法读取播放记录，请稍后刷新。');
  }
  const rows = [...counts.values()].sort((a, b) =>
    b.day.localeCompare(a.day) || b.issue.localeCompare(a.issue));
  // The original launch validation wrote one record for each edition of November 14.
  const testCount = (row, field) => row.issue === '2026-11-14' && row.day === '2026-11-14'
    ? Math.min(row[field], 1) : 0;
  const adjusted = (row, field) => row[field] - testCount(row, field);
  const today = dayFormat.format(new Date());
  const todayTotal = rows.filter(row => row.day === today)
    .reduce((total, row) => total + adjusted(row, 'global') + adjusted(row, 'ny'), 0);
  const body = rows.map(row => `<tr><td>${row.day}</td><td>${row.issue}</td><td>${adjusted(row, 'global')}</td><td>${adjusted(row, 'ny')}</td></tr>`).join('');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(`<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>收听汇总 | IMPACTONE</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#f7f7f5;color:#001b40;font:16px/1.55 system-ui,sans-serif}
main{max-width:880px;margin:auto;padding:clamp(18px,5vw,54px)}
header{padding:24px;background:#001b40;color:#fff;border-bottom:4px solid #c8a84b}
header p,h1{margin:0}header p{color:#e5ca75;letter-spacing:.14em;font-size:.8rem}
h1{font-size:clamp(24px,5vw,34px);margin-top:5px}
.summary{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:19px 0}
button{border:1px solid #001b40;border-radius:5px;background:#fff;color:#001b40;padding:7px 11px;font:inherit;cursor:pointer;white-space:nowrap}
table{width:100%;background:#fff;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:clamp(.75rem,3.5vw,1rem)}
th,td{padding:10px clamp(4px,2vw,14px);text-align:right;border-bottom:1px solid #e4e7eb}
th{background:#e9edf3}th:nth-child(-n+2),td:nth-child(-n+2){text-align:left;white-space:nowrap}
.note{font-size:.9rem;color:#44536a}
</style></head>
<body><main><header><p>IMPACTONE</p><h1>每日必读 · 收听汇总</h1></header>
<div class="summary"><div>今日播放 <strong>${todayTotal}</strong> 次 <small>（纽约时间）</small></div><form method="get"><button>刷新数据</button></form></div>
<table><thead><tr><th scope="col">播放日期</th><th scope="col">新闻期号</th><th scope="col">国际版</th><th scope="col">纽约版</th></tr></thead>
<tbody>${body || '<tr><td colspan="4">暂无播放记录</td></tr>'}</tbody></table>
<p class="note">按实际开始播放计次，已扣除两版各一条上线测试。每次打开或刷新页面读取最新记录。</p>
</main></body></html>`);
}
