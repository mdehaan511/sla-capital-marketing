#!/usr/bin/env node
/**
 * generate-rates-page.mjs — build /rates/index.html from data/rates.json
 *
 *   node scripts/generate-rates-page.mjs
 *
 * Idempotent. Run whenever rates.json changes and commit the updated
 * /rates/index.html. Google notices "recently updated" and prefers it
 * over stale competitors.
 *
 * Why a separate page: /rates/ is a HIGH-INTENT search magnet. Investors
 * comparison-shop by typing "dscr loan rates" / "private lender rates
 * today". A single-purpose page ranks better than the same info buried
 * on a product hub.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const RATES_PATH = path.join(REPO_ROOT, 'data', 'rates.json');
const OUT_DIR = path.join(REPO_ROOT, 'rates');
const OUT = path.join(OUT_DIR, 'index.html');

const data = JSON.parse(fs.readFileSync(RATES_PATH, 'utf8'));
const products = Array.isArray(data.products) ? data.products : [];
const eff = data.effectiveDate || '';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtEffective(iso) {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[2]}/${m[3]}/${m[1]}`;
}

// Program-comparison rows, one per product.
const tableRows = products.map(p => `
        <tr>
          <td style="padding:14px 16px;border-top:1px solid var(--border);font-weight:600;color:var(--secondary)">
            <a href="${esc(p.url)}" style="color:var(--secondary);text-decoration:none;border-bottom:1px dotted var(--muted)">${esc(p.name)}</a>
          </td>
          <td style="padding:14px 16px;border-top:1px solid var(--border);font-family:var(--font-display);font-size:20px;color:var(--primary);font-weight:600">from ${esc(p.rateFrom)}</td>
          <td style="padding:14px 16px;border-top:1px solid var(--border);color:var(--muted)">${esc(p.rateRange)}</td>
          <td style="padding:14px 16px;border-top:1px solid var(--border);color:var(--muted)">${esc(p.term)}</td>
          <td style="padding:14px 16px;border-top:1px solid var(--border);color:var(--muted)">${esc(p.maxLTV)}</td>
        </tr>`).join('');

const detailCards = products.map(p => `
      <div class="card">
        <div class="chip" style="margin-bottom:14px">${esc(p.shortName)}</div>
        <h3><a href="${esc(p.url)}" style="color:var(--secondary);text-decoration:none">${esc(p.name)}</a></h3>
        <div style="font-family:var(--font-display);font-size:36px;font-weight:700;color:var(--primary);line-height:1;margin:14px 0 4px">from ${esc(p.rateFrom)}</div>
        <div style="color:var(--muted);font-size:13px;margin-bottom:20px">Range: ${esc(p.rateRange)}</div>
        <table style="width:100%;font-size:13px;border-collapse:collapse">
          <tbody>
            <tr><td style="padding:6px 0;color:var(--muted);width:130px">Term</td><td style="padding:6px 0;color:var(--text)">${esc(p.term)}</td></tr>
            <tr><td style="padding:6px 0;color:var(--muted)">Max LTV</td><td style="padding:6px 0;color:var(--text)">${esc(p.maxLTV)}</td></tr>
            <tr><td style="padding:6px 0;color:var(--muted)">Loan size</td><td style="padding:6px 0;color:var(--text)">${esc(p.loanSize)}</td></tr>
            <tr><td style="padding:6px 0;color:var(--muted)">Origination</td><td style="padding:6px 0;color:var(--text)">${esc(p.originationPoints)}</td></tr>
            <tr><td style="padding:6px 0;color:var(--muted)">Min FICO</td><td style="padding:6px 0;color:var(--text)">${esc(p.minFICO)}</td></tr>
            ${p.dscrMin && p.dscrMin !== 'N/A' ? `<tr><td style="padding:6px 0;color:var(--muted)">DSCR</td><td style="padding:6px 0;color:var(--text)">${esc(p.dscrMin)}</td></tr>` : ''}
            ${p.seasoning && p.seasoning !== 'N/A' ? `<tr><td style="padding:6px 0;color:var(--muted)">Seasoning</td><td style="padding:6px 0;color:var(--text)">${esc(p.seasoning)}</td></tr>` : ''}
            <tr><td style="padding:6px 0;color:var(--muted)">Close time</td><td style="padding:6px 0;color:var(--text)">${esc(p.closeTime)}</td></tr>
          </tbody>
        </table>
        <div style="margin-top:20px"><a href="${esc(p.url)}" style="color:var(--primary);font-weight:600">Program details →</a></div>
      </div>`).join('');

// Structured data — one LoanOrCredit per product + a FinancialProduct
// list wrapper. Rich-result-friendly + LLM-answer-friendly.
const jsonLdOffers = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'SLA Capital current lending rates',
  itemListElement: products.map((p, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: {
      '@type': 'LoanOrCredit',
      name: p.name,
      url: `https://slacapital.ai${p.url}`,
      provider: { '@type': 'FinancialService', name: 'SLA Capital', alternateName: 'Sir Lends A Lot LLC', url: 'https://slacapital.ai' },
      loanTerm: { '@type': 'QuantitativeValue', description: p.term },
      amount: { '@type': 'MonetaryAmount', currency: 'USD', description: p.loanSize },
      description: `Rate from ${p.rateFrom}. ${p.term}. ${p.maxLTV}. ${p.originationPoints} origination.`,
    },
  })),
};

const jsonLdFaq = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What are SLA Capital\'s current investor loan rates?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: `DSCR rental loans from ${products.find(p => p.slug === 'rental')?.rateFrom || '5.75%'} (30-year fixed). Fix & Flip bridge from ${products.find(p => p.slug === 'fix-n-flip')?.rateFrom || '9.5%'} (6–18 months). New Construction from ${products.find(p => p.slug === 'new-construction')?.rateFrom || '10%'} (18 or 24 months). Rates effective ${fmtEffective(eff)} and priced off the 5-year Treasury.`,
      },
    },
    {
      '@type': 'Question',
      name: 'Are SLA Capital\'s quoted rates the same rate you close at?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. The rate you\'re quoted through our sizer is the rate you close at. No bait-and-switch, no last-minute adjustments at the closing table.',
      },
    },
    {
      '@type': 'Question',
      name: 'How often do SLA Capital\'s rates update?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Rates re-price whenever the 5-year Treasury moves materially. Historical cadence is 1–3 changes per month. The effective date at the top of this page is the current rate sheet.',
      },
    },
    {
      '@type': 'Question',
      name: 'What states are these rates available in?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Every SLA Capital state (42 states). Same rates nationwide — no state-specific surcharges. See the map on the homepage for the full coverage list.',
      },
    },
  ],
};

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Current Loan Rates — DSCR, Fix &amp; Flip, New Construction | SLA Capital</title>
  <meta name="description" content="SLA Capital current investor loan rates effective ${fmtEffective(eff)}. DSCR from ${esc(products.find(p => p.slug === 'rental')?.rateFrom || '5.75%')}. Fix &amp; Flip from ${esc(products.find(p => p.slug === 'fix-n-flip')?.rateFrom || '9.5%')}. New Construction from ${esc(products.find(p => p.slug === 'new-construction')?.rateFrom || '10%')}. The rate you're quoted is the rate you close at." />
  <link rel="canonical" href="https://slacapital.ai/rates/" />
  <link rel="icon" type="image/x-icon" href="/assets/favicon.ico" />
  <link rel="icon" type="image/png" sizes="any" href="/assets/favicon.png" />
  <link rel="apple-touch-icon" href="/assets/favicon.png" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="SLA Capital" />
  <meta property="og:title" content="Current Loan Rates — DSCR, Fix &amp; Flip, New Construction | SLA Capital" />
  <meta property="og:description" content="Investor loan rates effective ${fmtEffective(eff)}. Priced off the 5-year Treasury with transparent up-front quotes." />
  <meta property="og:url" content="https://slacapital.ai/rates/" />
  <meta property="og:image" content="https://slacapital.ai/assets/logo.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="stylesheet" href="/assets/brand.css" />

  <script type="application/ld+json">${JSON.stringify(jsonLdOffers)}</script>
  <script type="application/ld+json">${JSON.stringify(jsonLdFaq)}</script>
</head>
<body>
  <div class="legal-strip"><div class="container"><strong>SLA Capital</strong> — a Sir Lends A Lot LLC Company</div></div>

  <nav class="site-nav">
    <div class="container nav-inner">
      <a href="/" class="brand" style="display:inline-flex;align-items:center"><img src="/assets/logo.png" alt="SLA Capital" style="height:44px;width:auto" /></a>
      <ul class="nav-links">
        <li><a href="/rental/">DSCR</a></li>
        <li><a href="/fix-n-flip/">Fix &amp; Flip</a></li>
        <li><a href="/new-construction/">New Construction</a></li>
        <li><a href="/rates/" style="color:var(--primary)">Rates</a></li>
        <li><a href="/blog/">Blog</a></li>
        <li><a href="/current-jobs/">Careers</a></li>
        <li><a href="mailto:payoffs@slacapital.com">Request Payoff</a></li>
        <li><a href="/apply/" class="btn btn-primary">Apply Now</a></li>
      </ul>
    </div>
  </nav>

  <div class="container" style="padding-top:16px;font-size:14px;color:var(--muted)">
    <a href="/" style="color:var(--muted)">Home</a> · <span>Rates</span>
  </div>

  <section class="section" style="padding-top:48px;padding-bottom:32px">
    <div class="container" style="max-width:900px;text-align:center">
      <div class="eyebrow">Current rates · Effective ${fmtEffective(eff)}</div>
      <h1 style="font-size:44px;line-height:1.12;margin-bottom:16px">Investor loan rates you can plan on.</h1>
      <p class="lede" style="max-width:680px;margin:0 auto">Priced off the 5-year Treasury. The rate you're quoted through our sizer is the rate you close at — no bait-and-switch at the closing table. Rates below are effective as of ${fmtEffective(eff)} and apply nationwide across our ${esc(data.shared?.coverage || '42 states')}.</p>
      <div style="margin-top:28px;display:flex;gap:14px;justify-content:center;flex-wrap:wrap">
        <a href="/apply/" class="btn btn-primary btn-lg">Get Qualified in Minutes</a>
        <a href="mailto:apply@slacapital.com" class="btn btn-ghost btn-lg">Email Your Deal</a>
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:16px">
    <div class="container">
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:separate;border-spacing:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;font-size:15px;min-width:720px">
          <thead>
            <tr style="background:var(--secondary);color:#fff">
              <th style="padding:14px 16px;text-align:left;font-weight:600">Program</th>
              <th style="padding:14px 16px;text-align:left;font-weight:600">Rate from</th>
              <th style="padding:14px 16px;text-align:left;font-weight:600">Rate range</th>
              <th style="padding:14px 16px;text-align:left;font-weight:600">Term</th>
              <th style="padding:14px 16px;text-align:left;font-weight:600">Max leverage</th>
            </tr>
          </thead>
          <tbody>${tableRows}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="section-tight section-tinted">
    <div class="container">
      <div style="text-align:center;margin-bottom:36px;max-width:680px;margin-left:auto;margin-right:auto">
        <div class="eyebrow">Program specs</div>
        <h2>Full rate + term breakdown by product.</h2>
        <p class="lede">Everything a loan officer would tell you on a discovery call, up front.</p>
      </div>
      <div class="grid grid-3">${detailCards}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container" style="max-width:760px">
      <div class="eyebrow">Rate FAQ</div>
      <h2>Common questions about our pricing.</h2>
      <details class="card" style="margin-top:24px;margin-bottom:12px"><summary style="font-weight:600;font-size:18px;cursor:pointer;color:var(--secondary)">Are the quoted rates the same rate we close at?</summary><p style="margin-top:12px;color:var(--muted)">Yes. The rate you're quoted through our sizer is the rate you close at. No bait-and-switch, no last-minute adjustments at the closing table.</p></details>
      <details class="card" style="margin-bottom:12px"><summary style="font-weight:600;font-size:18px;cursor:pointer;color:var(--secondary)">How often do rates update?</summary><p style="margin-top:12px;color:var(--muted)">Rates re-price whenever the 5-year Treasury moves materially. Historical cadence is 1–3 changes per month. The effective date at the top of this page is the current rate sheet.</p></details>
      <details class="card" style="margin-bottom:12px"><summary style="font-weight:600;font-size:18px;cursor:pointer;color:var(--secondary)">What drives adjustments off the "from" rate?</summary><p style="margin-top:12px;color:var(--muted)">FICO, LTV, property type, loan purpose (purchase / rate-and-term / cash-out), prepay penalty selection, and interest-only structure. Our sizer applies these transparently and shows every adjustment line-item on the rate sheet.</p></details>
      <details class="card" style="margin-bottom:12px"><summary style="font-weight:600;font-size:18px;cursor:pointer;color:var(--secondary)">What states do these rates apply in?</summary><p style="margin-top:12px;color:var(--muted)">Every SLA Capital state — ${esc(data.shared?.coverage || '42 states')}. Same rates nationwide, no state-specific surcharges.</p></details>
      <details class="card"><summary style="font-weight:600;font-size:18px;cursor:pointer;color:var(--secondary)">Do you lend to LLCs?</summary><p style="margin-top:12px;color:var(--muted)">Yes — all SLA Capital loans are made to business entities. ${esc(data.shared?.entities || 'LLC / corporation / partnership')}. Most borrowers close in an LLC for asset protection.</p></details>
    </div>
  </section>

  <section class="section section-dark">
    <div class="container" style="text-align:center;max-width:720px">
      <div class="eyebrow" style="color:var(--highlight)">Get started</div>
      <h2 style="color:#fff">Get a real quote in minutes.</h2>
      <p style="color:rgba(255,255,255,0.78);font-size:19px;margin-bottom:32px">Our sizer returns a term sheet with your actual rate, points, and cash-to-close. No credit pull, no commitment.</p>
      <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap">
        <a href="/apply/" class="btn btn-primary btn-lg">Get Qualified in Minutes</a>
        <a href="mailto:apply@slacapital.com" class="btn btn-ghost btn-lg" style="color:#fff;border-color:#fff">apply@slacapital.com</a>
      </div>
    </div>
  </section>

  <footer class="site-footer">
    <div class="container">
      <div class="grid grid-4">
        <div>
          <h4>SLA Capital</h4>
          <p style="color:rgba(255,255,255,0.6);font-size:14px;margin-bottom:16px">Sir Lends A Lot LLC. AI-Enhanced private lender. 42 states.</p>
          <p style="color:rgba(255,255,255,0.9);font-size:14px;line-height:1.7;margin:0"><strong style="color:#fff">Contact</strong><br><a href="tel:+15098467349" style="color:rgba(255,255,255,0.85)">(509) 846-7349</a><br><a href="mailto:apply@slacapital.com" style="color:rgba(255,255,255,0.85)">apply@slacapital.com</a></p>
        </div>
        <div>
          <h4>Loan Programs</h4>
          <ul style="list-style:none;padding:0;margin:0;line-height:2">
            <li><a href="/rental/">DSCR</a></li>
            <li><a href="/fix-n-flip/">Fix &amp; Flip</a></li>
            <li><a href="/new-construction/">New Construction</a></li>
            <li><a href="/rates/">Rates</a></li>
          </ul>
        </div>
        <div>
          <h4>Company</h4>
          <ul style="list-style:none;padding:0;margin:0;line-height:2">
            <li><a href="/#about-us">About Us</a></li>
            <li><a href="/current-jobs/">Careers</a></li>
            <li><a href="/blog/">Blog</a></li>
            <li><a href="mailto:apply@slacapital.com">Contact</a></li>
          </ul>
        </div>
        <div>
          <h4>Loan Servicing</h4>
          <ul style="list-style:none;padding:0;margin:0;line-height:2">
            <li><a href="https://portal.sitewire.co/" target="_blank" rel="noopener">Construction Draw</a></li>
            <li><a href="https://myfci.com/Login" target="_blank" rel="noopener">FCI</a></li>
            <li><a href="https://my.servicingpros.com/signin/borrower" target="_blank" rel="noopener">Servicing Pros</a></li>
            <li><a href="https://www.selenefinance.com/" target="_blank" rel="noopener">Selene Servicing</a></li>
            <li><a href="mailto:payoffs@slacapital.com">Request Payoff</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <div>© 2026 SLA Capital · Sir Lends A Lot LLC · All rights reserved.</div>
        <div><a href="/privacy-policy/">Privacy Policy</a></div>
      </div>
    </div>
  </footer>
</body>
</html>
`;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`✓ /rates/index.html written with ${products.length} products (effective ${eff})`);
