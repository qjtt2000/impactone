# V3.17 Mobile Reader Size Fix

- Fixes mobile Small / Medium / Large reader controls.
- Root cause: V3.16 mobile sample-matching CSS hard-coded body text to `15px !important`, overriding `--reader-size`.
- Mobile story, scan, and insight body text now use `font-size: var(--reader-size) !important`.
- Source captions continue to use `--source-size`.
- Existing functionality and layout are otherwise unchanged.
- Service-worker cache key bumped so mobile devices fetch the corrected CSS.
