const { randomUUID } = require('node:crypto');
const branch = 'reader-comments';
const git = 'https://api.github.com/repos/qjtt2000/impactone/contents';

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isPost = req.method === 'POST';
  if (isPost && !/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
    return res.status(415).json({ error: 'Expected JSON' });
  }
  const body = req.body || {};
  const issue = isPost ? body.issue : req.query.issue;
  if (typeof issue !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:-ny)?$/.test(issue)) {
    return res.status(400).json({ error: 'Invalid issue' });
  }

  const isLike = isPost && body.action === 'like';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (isLike && (typeof body.id !== 'string' || !/^[a-f0-9-]{36}$/.test(body.id))) {
    return res.status(400).json({ error: 'Invalid comment ID' });
  }
  if (isPost && !isLike && (!name || !text || name.length > 60 || text.length > 2000)) {
    return res.status(400).json({ error: 'Invalid name or comment' });
  }

  const token = process.env.COMMENTS_GITHUB_TOKEN;
  if (!token) return res.status(503).json({ error: 'Comments unavailable' });
  const headers = {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  const url = git + '/comments/' + issue + '.json';
  const created = { id: randomUUID(), name, text, time: Date.now(), likes: 0, pending: true };

  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetch(url + '?ref=' + branch, { headers, signal: AbortSignal.timeout(4000) });
      let comments = [];
      let sha;
      if (response.ok) {
        const file = await response.json();
        sha = file.sha;
        comments = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
      } else if (response.status !== 404) {
        throw new Error('GitHub read failed: ' + response.status);
      }

      if (!isPost) {
        return res.status(200).json(comments.filter(comment => comment.pending === false));
      }

      if (isLike) {
        const comment = comments.find(entry => entry.id === body.id && entry.pending === false);
        if (!comment) return res.status(404).json({ error: 'Comment not found' });
        comment.likes = Number(comment.likes || 0) + 1;
      } else {
        comments.unshift(created);
      }

      const content = Buffer.from(JSON.stringify(comments, null, 2) + '\n', 'utf8');
      if (content.length >= 1000000) return res.status(507).json({ error: 'Issue archive is full' });
      const write = await fetch(url, {
        method: 'PUT',
        headers,
        signal: AbortSignal.timeout(4000),
        body: JSON.stringify({
          branch,
          sha,
          content: content.toString('base64'),
          message: (isLike ? 'Update comment like for ' : 'Record reader comment for ') + issue
        })
      });
      if (write.ok) return res.status(isLike ? 200 : 201).json(isLike ? { ok: true } : created);
      if (write.status !== 409 && write.status !== 422) {
        throw new Error('GitHub write failed: ' + write.status);
      }
    }
  } catch (error) {
    console.error('Comment archive request failed:', error.message);
  }

  return res.status(503).json({ error: 'Comments unavailable' });
};
