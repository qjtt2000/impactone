import { put } from '@vercel/blob';

const origin = 'https://www.impactone.news';
const issuePattern = /^\d{4}-\d{2}-\d{2}(?:-ny)?$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
});

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const { issue, play } = req.body || {};
  if (typeof issue !== 'string' || !issuePattern.test(issue) ||
      typeof play !== 'string' || !uuidPattern.test(play)) return res.status(400).end();
  if (req.headers.origin !== origin ||
      req.headers.referer?.split(/[?#]/, 1)[0] !== origin + '/daily/' + issue + '.html') {
    return res.status(403).end();
  }

  const day = dayFormat.format(new Date());
  try {
    await put(`daily-listens/${issue}/${day}/${play}.txt`, '1', {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true
    });
  } catch (error) {
    console.error('Could not record daily audio play', error.name);
    return res.status(503).end();
  }
  return res.status(204).end();
}
