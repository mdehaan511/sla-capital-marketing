#!/usr/bin/env node
/**
 * generate-state-pages.mjs — build per-state SEO landing pages.
 *
 * Reads data/states.json and writes one HTML file per (state × product)
 * combination:
 *
 *   /rental/<slug>/index.html            (DSCR — 30-year fixed rental loans)
 *   /fix-n-flip/<slug>/index.html        (short-term bridge / fix & flip)
 *   /new-construction/<slug>/index.html  (ground-up construction)
 *
 * 41 states × 3 products = 123 pages.
 *
 * Run from the repo root:
 *   node scripts/generate-state-pages.mjs
 *
 * Idempotent — regenerates every page from the latest data. Safe to run
 * as often as you like; just `git add -A && git commit` afterwards.
 *
 * Adding a new state: append to data/states.json, rerun the script.
 * Editing a metro or a market signal: update data/states.json, rerun.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const STATES_PATH = path.join(REPO_ROOT, 'data', 'states.json');

const raw = fs.readFileSync(STATES_PATH, 'utf8');
const { states } = JSON.parse(raw);

/* ── Product config ─────────────────────────────────────────
   Each product knows its slug, its parent URL, its default hook
   copy, its program-specs card grid, and its FAQ template. */

const PRODUCTS = {
  dscr: {
    slug: 'rental',
    label: 'DSCR',
    fullLabel: 'DSCR Rental Loans',
    parentUrl: '/rental/',
    heroPromise: '30-Year Fixed from 5.75%',
    heroBody: (s) => `Long-term rental financing for investment properties across ${s.name} — qualified off the property's income, not your personal DTI. <strong>30-year fixed from 5.75%</strong>, up to <strong>80% LTV</strong>, and only <strong>3 months of seasoning</strong> on cash-out refinances. SLA Capital has closed deals across every major ${s.name} metro.`,
    definitionH2: 'What is a DSCR loan?',
    definitionBody: `A <strong>DSCR loan</strong> — short for Debt Service Coverage Ratio — is an investor mortgage that qualifies off the property's rental income rather than the borrower's personal income or debt-to-income ratio. If the property's rent covers the total housing payment (principal, interest, taxes, insurance, and HOA), the loan qualifies. Self-employed investors, LLC-title borrowers, and anyone with complex tax returns can build a rental portfolio without W-2 gymnastics.`,
    specsHeading: 'DSCR loan terms.',
    specsIntro: 'Same nationwide program, no state-specific surcharges.',
    specs: [
      { chip: 'Pricing',       h: 'Rates from 5.75%',  p: 'Priced off the 5-year Treasury. Real quote in minutes via our loan sizer — no bait-and-switch at close.' },
      { chip: 'Leverage',      h: 'Up to 80% LTV',      p: 'Purchase and rate-and-term refis up to 80% LTV. Cash-out refis with 3-month seasoning — no lease required.' },
      { chip: 'Structures',    h: 'Multiple options',   p: '30-year fixed, 5-year interest-only, 5/1 ARM, 7/1 ARM.' },
      { chip: 'Size',          h: '$55K to $3M',        p: (s) => `Single-asset from $55K to $3M. Portfolio structures for 2–10 ${s.name} properties on one note.` },
      { chip: 'Fees',          h: '1 point origination',p: 'Up-front pricing. One origination point, standard closing costs, no junk fees.' },
      { chip: 'Qualification', h: '1.0 DSCR minimum',   p: 'Property rent must cover PITIA. Below 1.0 scenarios can still qualify with reserves or a rate buy-up.' },
    ],
    loanTermSchema: { value: 30, unitCode: 'ANN' },
    amountSchema: { min: 55000, max: 3000000 },
    ctaHeading: (s) => `Ready to size a ${s.name} DSCR loan?`,
    faq: (s) => [
      { q: `Does SLA Capital lend on rental properties in ${s.name}?`, a: `Yes. SLA Capital funds DSCR rental loans throughout ${s.name} — ${s.metros.slice(0, 5).map(m => m.name).join(', ')}, and every other ${s.abbr} metro. Rates from <strong>5.75%</strong>, up to 80% LTV.` },
      { q: `What DSCR loan rates are available in ${s.name}?`, a: `${s.name} DSCR loans start at <strong>5.75%</strong> on a 30-year fixed structure. Priced off the 5-year Treasury with transparent up-front pricing — the rate you're quoted is the rate you close at.` },
      { q: `What ${s.name} metros does SLA Capital serve?`, a: `Every ${s.name} metro. High-volume markets: ${s.metros.slice(0, 5).map(m => m.name).join(', ')}. Secondary markets welcome.` },
      { q: `Is ${s.name} a good state for rental property investors?`, a: s.whyInvestor },
      { q: `How long is seasoning on a ${s.name} DSCR cash-out refinance?`, a: `<strong>3 months.</strong> Only 3 months of ownership seasoning is required for cash-out refinances on ${s.name} DSCR loans, and no active lease is required at closing.` },
    ],
    schemaDesc: (s) => `30-year fixed DSCR rental loan for investment properties in ${s.name}. Rates from 5.75%, up to 80% LTV, 3-month cash-out seasoning. Serving every major ${s.name} metro.`,
  },

  fixNFlip: {
    slug: 'fix-n-flip',
    label: 'Fix &amp; Flip',
    fullLabel: 'Fix &amp; Flip Loans',
    parentUrl: '/fix-n-flip/',
    heroPromise: 'Up to 100% Financing, 72-Hour Funding',
    heroBody: (s) => `Short-term purchase + rehab bridge loans for investors flipping properties in ${s.name}. Rates <strong>9.5–12%</strong>, up to <strong>100% loan-to-cost</strong> for premier borrowers, and <strong>100% of your rehab budget</strong> financed via draws. Close in as little as <strong>72 hours</strong> with clear title. SLA Capital has closed deals across every ${s.name} metro.`,
    definitionH2: 'What is a Fix &amp; Flip loan?',
    definitionBody: `A <strong>Fix and Flip loan</strong> is short-term bridge financing used to purchase and rehabilitate a distressed property before selling or refinancing it. Loan size is anchored to the property's after-repair value (ARV) — not its current condition — so investors can finance both the acquisition and the renovation on a single loan. Rehab dollars are disbursed via draws as work is completed and inspected.`,
    specsHeading: 'Fix &amp; Flip terms.',
    specsIntro: 'Same nationwide program, no state-specific surcharges.',
    specs: [
      { chip: 'Speed',    h: '72-hour close',      p: 'Close in as little as 72 hours with clear title. The fastest funding in the field when your deal needs to move.' },
      { chip: 'Pricing',  h: 'Rates 9.5–12%',       p: 'Points range 1–4. Transparent up-front pricing — no bait-and-switch, no surprise fees at the closing table.' },
      { chip: 'Leverage', h: 'Up to 100% LTC',      p: 'Premier repeat borrowers qualify for up to 100% loan-to-cost. First-timers welcome — LTC scales with experience.' },
      { chip: 'Rehab',    h: '100% rehab funded',   p: 'Full rehab budget financed and disbursed via draws after inspection. Photos + invoices approve same-day through our platform.' },
      { chip: 'Term',     h: '6–18 months',         p: 'Choose the term that fits your project. Extensions available on active deals.' },
      { chip: 'Size',     h: '$55K to $3M',         p: (s) => `Loans from $55,000 up to $3,000,000. From cosmetic flips to full gut jobs across ${s.name}.` },
    ],
    loanTermSchema: { min: 6, max: 18, unitCode: 'MON' },
    amountSchema: { min: 55000, max: 3000000 },
    ctaHeading: (s) => `Have a ${s.name} flip ready to close?`,
    faq: (s) => [
      { q: `Does SLA Capital lend on Fix &amp; Flip deals in ${s.name}?`, a: `Yes. SLA Capital funds Fix &amp; Flip bridge loans throughout ${s.name} — ${s.metros.slice(0, 5).map(m => m.name).join(', ')}, and every other ${s.abbr} metro. Rates 9.5–12%, up to 100% LTC for premier borrowers.` },
      { q: `How fast can SLA close a ${s.name} Fix &amp; Flip loan?`, a: `<strong>As little as 72 hours</strong> from application to funding when the title is clear and the file is complete. Average close across all ${s.name} Fix &amp; Flip loans is 7–10 days.` },
      { q: `How much of the rehab budget does SLA finance?`, a: `SLA Capital finances <strong>100% of rehab costs</strong> on ${s.name} Fix &amp; Flip loans. Funds are disbursed via draws after inspection of completed work. Photo-and-invoice draw requests run through our platform for same-day approvals.` },
      { q: `What ${s.name} metros does SLA Capital serve?`, a: `Every ${s.name} metro. High-volume markets: ${s.metros.slice(0, 5).map(m => m.name).join(', ')}. Secondary markets welcome — send us any ${s.name} property.` },
      { q: `Is ${s.name} a good state for Fix &amp; Flip investors?`, a: s.whyInvestor },
    ],
    schemaDesc: (s) => `Purchase-plus-rehab bridge loan for investors flipping properties in ${s.name}. Rates 9.5–12%, 1–4 points. Up to 100% LTC for premier borrowers. Close in as little as 72 hours.`,
  },

  newConstruction: {
    slug: 'new-construction',
    label: 'New Construction',
    fullLabel: 'New Construction Loans',
    parentUrl: '/new-construction/',
    heroPromise: '85% Land + 85% Build',
    heroBody: (s) => `Ground-up construction loans for builders and investors developing new properties in ${s.name}. Finance up to <strong>85% of your land purchase</strong> and <strong>85% of construction costs</strong> on a single loan. Rates from <strong>10%</strong>, non-Dutch interest, and land doesn't need to be permitted to qualify. Loans <strong>$100K to $7.5M</strong>.`,
    definitionH2: 'What is a new construction loan?',
    definitionBody: `A <strong>new construction loan</strong> is short-term financing for building a property from the ground up. It typically covers land acquisition, vertical construction, and an interest reserve on a single loan, with construction funds disbursed via draws as the build progresses through inspection milestones. Once construction is complete, the loan is paid off through a sale of the finished property or refinanced into long-term financing.`,
    specsHeading: 'New Construction terms.',
    specsIntro: 'Same nationwide program, no state-specific surcharges.',
    specs: [
      { chip: 'Pricing',       h: 'Rates from 10%',       p: 'Up-front pricing on every loan. The rate you\'re quoted is the rate you close at — no surprises at the closing table.' },
      { chip: 'Leverage',      h: '85% land / 85% build', p: 'Up to 85% of the land purchase price plus 85% of construction costs. High leverage that keeps your capital deployable.' },
      { chip: 'Interest',      h: 'Non-Dutch interest',   p: 'Pay interest only on the funds you\'ve actually drawn, not on the undrawn balance. Keeps carrying costs down during early build phases.' },
      { chip: 'Term',          h: '18 or 24 months',       p: 'Choose the term that fits your build schedule. Straightforward extensions available on active projects.' },
      { chip: 'Approval',      h: 'Unpermitted land OK',   p: 'Land does not need to be permitted or warranted before loan approval. Get under contract and permit in parallel.' },
      { chip: 'Size',          h: '$100K to $7.5M',        p: (s) => `From single infill lots to multi-unit projects across ${s.name}. Same clean underwriting from starter builds up to $7.5M.` },
    ],
    loanTermSchema: { min: 18, max: 24, unitCode: 'MON' },
    amountSchema: { min: 100000, max: 7500000 },
    ctaHeading: (s) => `Ready to size a ${s.name} build?`,
    faq: (s) => [
      { q: `Does SLA Capital lend on New Construction in ${s.name}?`, a: `Yes. SLA Capital funds New Construction loans throughout ${s.name} — ${s.metros.slice(0, 5).map(m => m.name).join(', ')}, and every other ${s.abbr} metro. Rates from 10%, up to 85% land + 85% construction.` },
      { q: `How much of the ${s.name} project does SLA finance?`, a: `SLA Capital finances up to <strong>85% of the land purchase</strong> plus <strong>85% of construction costs</strong> in ${s.name}. Loans range from <strong>$100,000 to $7,500,000</strong>.` },
      { q: `Does the land need to be permitted to qualify?`, a: `<strong>No.</strong> SLA Capital does not require the land to be permitted or warranted before loan approval. Get under contract and start underwriting in parallel with permitting.` },
      { q: `How is interest calculated on the loan?`, a: `<strong>Non-Dutch interest</strong> — borrowers pay interest only on funds that have been drawn, not on the undrawn balance. This keeps carrying costs down during early build phases when most of the loan hasn't been disbursed yet.` },
      { q: `Is ${s.name} a good state for ground-up builders?`, a: s.whyInvestor },
    ],
    schemaDesc: (s) => `Ground-up New Construction loan for real estate investors in ${s.name}. Finances up to 85% of land purchase plus 85% of construction costs. Non-Dutch interest — pay interest only on drawn funds. 18–24 month terms.`,
  },
};

/* ── Shared HTML chunks ─────────────────────────────────── */

function legalStrip() {
  return `  <div class="legal-strip"><div class="container"><strong>SLA Capital</strong> — a Sir Lends A Lot LLC Company</div></div>`;
}

function nav(activeProductSlug) {
  return `
  <nav class="site-nav">
    <div class="container nav-inner">
      <a href="/" class="brand" style="display:inline-flex;align-items:center"><img src="/assets/logo.png" alt="SLA Capital" style="height:44px;width:auto" /></a>
      <ul class="nav-links">
        <li><a href="/rental/"${activeProductSlug === 'rental' ? ' style="color:var(--primary)"' : ''}>DSCR</a></li>
        <li><a href="/fix-n-flip/"${activeProductSlug === 'fix-n-flip' ? ' style="color:var(--primary)"' : ''}>Fix &amp; Flip</a></li>
        <li><a href="/new-construction/"${activeProductSlug === 'new-construction' ? ' style="color:var(--primary)"' : ''}>New Construction</a></li>
        <li><a href="/blog/">Blog</a></li>
        <li><a href="/current-jobs/">Careers</a></li>
        <li><a href="mailto:payoffs@slacapital.com">Request Payoff</a></li>
        <li><a href="/apply/" class="btn btn-primary">Apply Now</a></li>
      </ul>
    </div>
  </nav>`;
}

function footer() {
  return `
  <footer class="site-footer">
    <div class="container">
      <div class="grid grid-4">
        <div>
          <h4>SLA Capital</h4>
          <p style="color:rgba(255,255,255,0.6);font-size:14px;margin-bottom:16px">Sir Lends A Lot LLC. AI-Enhanced private lender. 42 states.</p>
          <p style="color:rgba(255,255,255,0.9);font-size:14px;line-height:1.7;margin:0"><strong style="color:#fff">Contact</strong><br><a href="mailto:apply@slacapital.com" style="color:rgba(255,255,255,0.85)">apply@slacapital.com</a></p>
        </div>
        <div><h4>Loan Programs</h4><ul style="list-style:none;padding:0;margin:0;line-height:2"><li><a href="/rental/">DSCR</a></li><li><a href="/fix-n-flip/">Fix &amp; Flip</a></li><li><a href="/new-construction/">New Construction</a></li></ul></div>
        <div><h4>Company</h4><ul style="list-style:none;padding:0;margin:0;line-height:2"><li><a href="/#about-us">About Us</a></li><li><a href="/current-jobs/">Careers</a></li><li><a href="/blog/">Blog</a></li><li><a href="mailto:apply@slacapital.com">Contact</a></li></ul></div>
        <div><h4>Loan Servicing</h4><ul style="list-style:none;padding:0;margin:0;line-height:2"><li><a href="https://portal.sitewire.co/" target="_blank" rel="noopener">Construction Draw</a></li><li><a href="https://myfci.com/Login" target="_blank" rel="noopener">FCI</a></li><li><a href="https://my.servicingpros.com/signin/borrower" target="_blank" rel="noopener">Servicing Pros</a></li><li><a href="https://www.selenefinance.com/" target="_blank" rel="noopener">Selene Servicing</a></li><li><a href="mailto:payoffs@slacapital.com">Request Payoff</a></li></ul></div>
      </div>
      <div class="footer-bottom"><div>© 2026 SLA Capital · Sir Lends A Lot LLC · All rights reserved.</div><div><a href="/privacy-policy/">Privacy Policy</a></div></div>
    </div>
  </footer>`;
}

function specsGrid(product, state) {
  return `
      <div class="grid grid-3">
${product.specs.map(spec => {
  const body = typeof spec.p === 'function' ? spec.p(state) : spec.p;
  return `        <div class="card"><div class="chip" style="margin-bottom:16px">${spec.chip}</div><h4>${spec.h}</h4><p style="color:var(--muted)">${body}</p></div>`;
}).join('\n')}
      </div>`;
}

function metrosGrid(state) {
  const tiles = state.metros.map(m => `        <div class="metro-tile"><h4>${m.name}</h4><p>${m.detail}</p></div>`);
  tiles.push(`        <div class="metro-tile"><h4>Everywhere else</h4><p>Statewide coverage — send us any ${state.name} property</p></div>`);
  return `      <div class="metro-grid">\n${tiles.join('\n')}\n      </div>`;
}

function faqSection(product, state) {
  const items = product.faq(state);
  const rendered = items.map((item, i) => {
    const trailing = i === items.length - 1 ? '' : ' style="margin-bottom:12px"';
    return `      <details class="card"${trailing}><summary style="font-weight:600;font-size:18px;cursor:pointer;color:var(--secondary)">${item.q}</summary><p style="margin-top:12px;color:var(--muted)">${item.a}</p></details>`;
  }).join('\n');
  return rendered;
}

function faqSchema(product, state) {
  const items = product.faq(state);
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: stripTags(item.q),
      acceptedAnswer: { '@type': 'Answer', text: stripTags(item.a) },
    })),
  });
}

function loanSchema(product, state) {
  const loanTerm = product.loanTermSchema.value != null
    ? { '@type': 'QuantitativeValue', value: product.loanTermSchema.value, unitCode: product.loanTermSchema.unitCode }
    : { '@type': 'QuantitativeValue', minValue: product.loanTermSchema.min, maxValue: product.loanTermSchema.max, unitCode: product.loanTermSchema.unitCode };
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'LoanOrCredit',
    name: `${product.fullLabel.replace('&amp;', '&')} — ${state.name}`.replace(/<[^>]+>/g, ''),
    url: `https://slacapital.ai${product.parentUrl}${state.slug}/`,
    provider: { '@type': 'FinancialService', name: 'SLA Capital', alternateName: 'Sir Lends A Lot LLC', url: 'https://slacapital.ai' },
    loanType: product === PRODUCTS.dscr ? 'Non-QM investment property loan' : product === PRODUCTS.fixNFlip ? 'Short-term real estate bridge loan' : 'Ground-up construction loan',
    loanTerm,
    amount: { '@type': 'MonetaryAmount', currency: 'USD', minValue: product.amountSchema.min, maxValue: product.amountSchema.max },
    areaServed: { '@type': 'State', name: state.name },
    description: product.schemaDesc(state),
  });
}

function otherProductsCrossLinks(currentProductKey, state) {
  const others = Object.entries(PRODUCTS).filter(([k]) => k !== currentProductKey);
  const cards = others.map(([key, p]) => {
    const chip = key === 'dscr' ? '30-year fixed' : key === 'fixNFlip' ? 'Bridge' : 'Ground-up';
    const oneLiner = key === 'dscr'
      ? `Long-term rental financing for ${state.name} investors. Rates from 5.75%, up to 80% LTV, 3-month seasoning on cash-outs.`
      : key === 'fixNFlip'
        ? `Short-term purchase + rehab financing across every ${state.name} metro. Rates 9.5–12%. Up to 100% LTC for premier borrowers.`
        : `Ground-up construction loans for ${state.name} builders. 85% land + 85% build. $100K–$7.5M.`;
    return `        <a class="card" href="${p.parentUrl}${state.slug}/" style="text-decoration:none;color:inherit"><div class="chip" style="margin-bottom:16px">${chip}</div><h3>${p.label} Loans in ${state.name}</h3><p>${oneLiner}</p><div style="color:var(--primary);font-weight:600">Explore ${p.label} ${state.name} →</div></a>`;
  });
  return `      <div class="grid grid-2">\n${cards.join('\n')}\n      </div>`;
}

function stripTags(s) {
  return String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
}

/* ── Top-level page template ───────────────────────────── */

function renderPage(product, state) {
  const productSlugForNav = product.slug;
  const title = `${product.fullLabel.replace('&amp;', '&')} ${state.name} — ${product.heroPromise} | SLA Capital`;
  const metaDesc = `${state.name} ${product.fullLabel.replace('&amp;', '&')} from SLA Capital. ${product.heroPromise}. Serving ${state.metros.slice(0, 4).map(m => m.name).join(', ')}, and every ${state.name} metro.`;
  const canonical = `https://slacapital.ai${product.parentUrl}${state.slug}/`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${metaDesc}" />
  <link rel="canonical" href="${canonical}" />
  <link rel="icon" type="image/x-icon" href="/assets/favicon.ico" />
  <link rel="icon" type="image/png" sizes="any" href="/assets/favicon.png" />
  <link rel="apple-touch-icon" href="/assets/favicon.png" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="SLA Capital" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${metaDesc}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="https://slacapital.ai/assets/logo.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="stylesheet" href="/assets/brand.css" />

  <script type="application/ld+json">${loanSchema(product, state)}</script>
  <script type="application/ld+json">${faqSchema(product, state)}</script>
</head>
<body>
${legalStrip()}
${nav(productSlugForNav)}

  <div class="container" style="padding-top:16px;font-size:14px;color:var(--muted)">
    <a href="/" style="color:var(--muted)">Home</a> · <a href="${product.parentUrl}" style="color:var(--muted)">${product.label}</a> · <span>${state.name}</span>
  </div>

  <!-- HERO -->
  <section class="section" style="padding-top:48px;padding-bottom:48px">
    <div class="container" style="max-width:820px">
      <div class="eyebrow">${product.fullLabel} · ${state.name}</div>
      <h1 style="font-size:42px;line-height:1.15;margin-bottom:20px">${product.label} loans for ${state.name} ${product === PRODUCTS.dscr ? 'rental properties' : product === PRODUCTS.fixNFlip ? 'flips' : 'builds'}.</h1>
      <p class="lede">${product.heroBody(state)}</p>
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:24px">
        <a href="/apply/" class="btn btn-primary btn-lg">Get Qualified in Minutes</a>
        <a href="mailto:apply@slacapital.com?subject=${encodeURIComponent(state.name + ' ' + product.fullLabel.replace('&amp;', '&') + ' — Deal')}" class="btn btn-ghost btn-lg">Email Your Deal</a>
      </div>
      <p style="margin-top:14px;font-size:13px;color:var(--muted)">SLA Capital — a Sir Lends A Lot LLC Company</p>
    </div>
  </section>

  <!-- DEFINITION -->
  <section class="section-tight section-tinted">
    <div class="container" style="max-width:820px">
      <h2 style="font-size:26px">${product.definitionH2}</h2>
      <p>${product.definitionBody}</p>
    </div>
  </section>

  <!-- WHY <STATE> — market signals -->
  <section class="section">
    <div class="container" style="max-width:900px">
      <div class="eyebrow">${state.name} market</div>
      <h2>Why ${state.name} works for investor lending.</h2>
      <p>${state.whyInvestor}</p>
      <div class="grid grid-3" style="margin-top:32px">
${state.signals.map(sig => `        <div>\n          <h4>${sig.title}</h4>\n          <p style="color:var(--muted)">${sig.body}</p>\n        </div>`).join('\n')}
      </div>
    </div>
  </section>

  <!-- METROS -->
  <section class="section section-tinted">
    <div class="container" style="max-width:900px">
      <div class="eyebrow">Metros served</div>
      <h2>SLA Capital lends across every ${state.name} metro.</h2>
      <p>Whether you're closing a single-asset SFR in a smaller ${state.name} market or a portfolio in a major metro, we're active statewide. High-volume markets we regularly close in include:</p>
${metrosGrid(state)}
    </div>
  </section>

  <!-- PROGRAM SPECS -->
  <section class="section">
    <div class="container">
      <h2 style="text-align:center;margin-bottom:16px">${state.name} ${product.specsHeading}</h2>
      <p style="text-align:center;color:var(--muted);margin-bottom:48px">${product.specsIntro}</p>
${specsGrid(product, state)}
    </div>
  </section>

  <!-- FAQ -->
  <section class="section section-tinted">
    <div class="container" style="max-width:820px">
      <div style="text-align:center;margin-bottom:48px"><div class="eyebrow">${state.name} ${product.label} FAQ</div><h2>Common questions about ${product.label} loans in ${state.name}.</h2></div>
${faqSection(product, state)}
    </div>
  </section>

  <!-- FINAL CTA -->
  <section class="section section-dark">
    <div class="container" style="text-align:center;max-width:720px">
      <div class="eyebrow" style="color:var(--highlight)">Get started</div>
      <h2 style="color:#fff">${product.ctaHeading(state)}</h2>
      <p style="color:rgba(255,255,255,0.78);font-size:19px;margin-bottom:32px">Send us the property. Our sizer returns a real term sheet in minutes.</p>
      <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap">
        <a href="/apply/" class="btn btn-primary btn-lg">Get Qualified in Minutes</a>
        <a href="mailto:apply@slacapital.com" class="btn btn-ghost btn-lg" style="color:#fff;border-color:#fff">apply@slacapital.com</a>
      </div>
    </div>
  </section>

  <!-- CROSS-LINK to other products for this state -->
  <section class="section">
    <div class="container">
      <div style="text-align:center;margin-bottom:40px"><div class="eyebrow">Also in ${state.name}</div><h2>Other loan programs for ${state.name} investors</h2></div>
${otherProductsCrossLinks(Object.keys(PRODUCTS).find(k => PRODUCTS[k] === product), state)}
    </div>
  </section>

${footer()}

</body>
</html>
`;
}

/* ── Write all pages ────────────────────────────────────── */

let written = 0;
for (const state of states) {
  for (const [key, product] of Object.entries(PRODUCTS)) {
    const dir = path.join(REPO_ROOT, product.slug, state.slug);
    fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, 'index.html');
    fs.writeFileSync(filepath, renderPage(product, state));
    written++;
  }
}

console.log(`✓ generated ${written} state pages from ${states.length} states × ${Object.keys(PRODUCTS).length} products`);
console.log(`  states/products: ${states.length} × ${Object.keys(PRODUCTS).length}`);
console.log(`  next: git add -A && git commit -m "State pages: full generation"`);
