# IMPACTONE V3.16 — 2026-09-06 Layout & Icon Update

This build starts from the approved V3.16 package and intentionally preserves existing functional behavior.

Requested changes only:
- Replace footer IMPACTONE logo with supplied original artwork.
- Replace cover skyline with supplied NYC skyline artwork.
- Replace Daily Focus icon with supplied artwork.
- Replace Daily Scan icon with supplied magnifier artwork.
- Replace IMPACTONE VIEW marker with supplied artwork.
- Force mobile Daily Focus / Daily Scan / View Chinese section headings to serif-bold font stack.
- Add image caption/source under the lead image.
- Daily Scan now shows the summary by default and expands only supplemental details.
- Add Previous Issue navigation plumbing; issue 001 auto-hides it, later issues display it when `data-previous-url` is populated.
- Product value line removes the fixed “12条”.
- Reader sizing remains scoped to readable body text: small ≈ -10%, medium = current baseline, large ≈ +18%; source caption grows only slightly in large mode.

Unchanged by design:
- Subscribe / PWA / notifications
- Share
- Favorite
- Comments
- Supabase/runtime endpoints
- Login/register
- Existing route/deployment structure
