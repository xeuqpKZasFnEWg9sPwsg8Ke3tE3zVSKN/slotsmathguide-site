# Affiliate wiring (pending IDs)

## How outbound offers work
All outbound operator CTAs should point to `/go/{slug}/`.

- Today: `/go/{slug}/` redirects to the official operator site (no tracking).
- Later: we update `affiliate/offers.json` with the tracked URL (affiliate link) for that slug and swap `/go/{slug}/` to redirect to `trackedUrl` instead of `officialUrl`.

## What you will provide later
For each operator slug (example: `betmgm`):
- tracked URL (full affiliate URL or base URL + params)
- any required subid parameter name (e.g., `clickid`, `subid`, `aff_sub`)

## File to edit
- `affiliate/offers.json`

## Notes
- `/go/` pages are `noindex,nofollow` and use a meta refresh redirect.
- Keep money pages factual and terms-first; avoid unverified claims.
