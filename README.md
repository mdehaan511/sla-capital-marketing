# SLA Capital marketing site

Public marketing site for SLA Capital / Sir Lends A Lot LLC. Companion to the loan-officer app at [portal.slacapital.ai](https://portal.slacapital.ai) (repo: `sla-capital-lo-tools`).

- **Live**: <https://slacapital.ai>
- **Hosting**: Netlify (static + Netlify Functions)
- **Stack**: vanilla HTML + CSS. No build step, no framework. Same no-bundler ethos as the app repo.

## Repo layout

```
.
├── index.html                # /
├── rental/index.html         # /rental/ (DSCR)
├── fix-n-flip/index.html     # /fix-n-flip/
├── new-construction/index.html
├── apply/index.html          # /apply/  (borrower application, migrated from the app)
├── blog/index.html           # /blog/   (post index)
├── blog/<slug>/index.html    # blog posts (one folder per post)
├── loans/                    # per-market landing pages (planned)
│   └── dscr/texas/index.html # example: /loans/dscr/texas/
├── legal/privacy-policy/index.html
├── careers/index.html        # /current-jobs/ alias
├── assets/
│   ├── brand.css             # design tokens + primitives (single source of truth)
│   ├── logo.svg
│   └── og-cover.jpg
├── _partials.html            # nav + footer snippets to copy into each page
├── netlify.toml              # redirects + cache headers + functions dir
├── netlify/functions/
│   └── lead-submit.mjs       # contact form → Resend
└── README.md
```

## Design tokens

Extracted from the current WordPress/Elementor build so the rebuild looks identical to what LOs and brokers already recognize. Everything lives in [`assets/brand.css`](assets/brand.css):

| Token | Value | Notes |
|---|---|---|
| `--primary` | `#DA7238` | Warm orange, CTAs / primary buttons |
| `--secondary` | `#281D28` | Dark plum, headings + nav + dark surfaces |
| `--highlight` | `#FFBC7D` | Peach accent, chips / callouts |
| `--neutral` | `#F2F2F2` | Section tint |
| `--font-display` | Roboto Slab | Hero + section headings |
| `--font-body` | Roboto | UI + body copy |

## Local dev

```
npx netlify dev
```

Serves `.` on http://localhost:8888 with Netlify Functions live-reloading from `netlify/functions/`.

## Deploy

Netlify auto-deploys `main`. Same workflow as the app:

```
git push origin main
```

Check Netlify's build log if a deploy doesn't publish within ~90s.

## Environment variables (set on Netlify dashboard)

- `RESEND_API_KEY` — required for the `/api/lead-submit` contact form.
- `LEAD_INBOX` — optional, defaults to `apply@slacapital.com`.
- `LEAD_FROM` — optional, defaults to `SLA Capital <noreply@leads.slacapital.com>`.

## SEO notes

- Every page carries its own `<title>`, `<meta name="description">`, `og:*`, and a JSON-LD block. Homepage is `FinancialService`; loan pages are `LoanOrCredit`; blog posts are `Article`.
- `netlify.toml` enforces `Cache-Control: public, max-age=60, must-revalidate` on HTML so content edits show up immediately.
- 301 redirects for the WordPress URLs live in `netlify.toml` — add new entries there as we discover more inbound links.
- Sitemap + robots.txt: TODO before launch. Auto-regenerate at deploy time from the repo's HTML file list.

## Planned per-market pages

- `/loans/dscr/<state>/` — one page per major state we lend in (TX, FL, GA, TN, OH, NC, SC, AZ, ...).
- `/loans/fix-n-flip/<state>/` — same shape.
- `/loans/new-construction/<state>/`

Each is templated off the parent product page with state-specific title/hero/body copy + a `LocalBusiness` JSON-LD.
