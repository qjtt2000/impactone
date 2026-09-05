# IMPACTONE Daily V3.1 — Sample-led + functional interaction layer

## What V3.1 changes
- Keeps the approved sample as the visual source of truth; the PDF specification remains secondary.
- Enlarges cover, typography, spacing, section headers, footer, and skyline proportions to better match the approved mobile sample.
- The bottom action bar is truly `position: fixed` and remains visible while the reader scrolls: Subscribe / Share / Favorite / Comment.
- DAILY SCAN defaults to headline + 快评. The event summary is folded and opens only when the reader taps “展开全文 ＋”.
- Share center supports system share, Facebook, X, LinkedIn, WhatsApp, email, copy link, plus WeChat-specific guidance. Official social profile links can be configured in `impactone-config.js`.
- Subscription posts to a Supabase Edge Function. `send-daily` can push each new issue to all active subscribers through Resend.
- Comments support server storage, moderation status, reply UI, likes, timestamps, and comment counts.
- Favorites support a new Supabase `favorites` table and Edge Function. Anonymous preview uses a persistent browser client id; a future login system can replace that with user_id.

## Preview vs production
With endpoint fields empty in `impactone-config.js`, the page remains fully testable: subscription/favorite/comment data falls back to localStorage. Social share links work without a backend.

For production, deploy these Supabase Edge Functions and paste their URLs into `impactone-config.js`:
- `subscribe`
- `comments`
- `favorites`
- `send-daily` (admin-only; normally called from CMS/publishing workflow, not the public page)

## Push flow
1. Reader submits email -> `subscribe` -> `subscribers` table.
2. Editor publishes a new issue in the CMS/static publishing workflow.
3. Publishing workflow calls `send-daily` with the issue URL, subject, preview, and headlines.
4. `send-daily` reads active subscribers and sends the issue through Resend.
5. Set `UNSUBSCRIBE_URL` later to an unsubscribe endpoint/page; `send-daily` already inserts the subscriber token in the link.

Required Supabase secrets for `send-daily`:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `IMPACTONE_ADMIN_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM` (recommended: `IMPACTONE <daily@impactone.news>` after domain verification)
- `UNSUBSCRIBE_URL` (optional until unsubscribe page/function is added)

## Production note
Before a commercial email launch, add double opt-in, unsubscribe completion, bounce/complaint handling, and a privacy policy. The database and send flow in this package are structured so those can be added without changing the daily page template.
