// render-og.js — generate 1200x630 Open Graph images for slacapital.ai pages.
// Run from ~/tools/cardgen so sharp resolves: node ~/sla-og/render-og.js
const sharp = require(process.env.HOME + '/tools/cardgen/node_modules/sharp');
const fs = require('fs');
const OUT = process.env.HOME + '/code/sla-capital-marketing/assets/og/';
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  { slug: 'dscr-loans-explained',        eyebrow: 'Investor guide · DSCR',            l1: 'DSCR loans,',              l2: 'explained.' },
  { slug: 'arv-fix-and-flip-explained',  eyebrow: 'Investor guide · Fix &amp; Flip',  l1: 'ARV: what lenders',        l2: 'actually count.' },
  { slug: 'dscr-cash-out-seasoning',     eyebrow: 'Investor guide · DSCR',            l1: '3-month cash-out',         l2: 'seasoning.' },
  { slug: 'dscr-loan-requirements',      eyebrow: 'Investor guide · DSCR',            l1: 'DSCR loan requirements:',  l2: 'the full checklist.' },
  { slug: 'hard-money-vs-dscr-loans',    eyebrow: 'Investor guide · Strategy',        l1: 'Hard money vs. DSCR:',     l2: 'which fits your deal?' },
  { slug: 'how-construction-draws-work', eyebrow: 'Investor guide · Construction',    l1: 'How construction',         l2: 'draws work.' },
  { slug: 'rates',                       eyebrow: 'Always public',                    l1: 'Rates. Posted.',           l2: 'Publicly.' },
  { slug: 'careers',                     eyebrow: 'Now hiring · Loan Officer',        l1: 'Bring the hustle.',        l2: 'We bring the machine.' },
];

function svg(p) {
  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
<rect width="1200" height="630" fill="#281D28"/>
<rect x="72" y="64" width="8" height="88" fill="#DA7238"/>
<rect x="88" y="64" width="8" height="88" fill="#DA7238"/>
<text x="116" y="112" font-family="DejaVu Sans, sans-serif" font-size="40" font-weight="bold" fill="#FFFFFF">SLA <tspan fill="#DA7238">Capital</tspan></text>
<text x="116" y="144" font-family="DejaVu Sans, sans-serif" font-size="20" fill="#B8AFB8">Private lending for real estate investors</text>
<text x="72" y="300" font-family="DejaVu Sans, sans-serif" font-size="28" font-weight="bold" letter-spacing="3" fill="#FFBC7D">${p.eyebrow}</text>
<text x="72" y="390" font-family="DejaVu Serif, Georgia, serif" font-size="72" font-weight="bold" fill="#FFFFFF">${p.l1}</text>
<text x="72" y="472" font-family="DejaVu Serif, Georgia, serif" font-size="72" font-weight="bold" fill="#FFFFFF">${p.l2}</text>
<text x="72" y="570" font-family="DejaVu Sans, sans-serif" font-size="24" fill="#8F858F">slacapital.ai &#183; NMLS #2863552</text>
</svg>`;
}

(async () => {
  for (const p of PAGES) {
    const png = OUT + p.slug + '.png';
    await sharp(Buffer.from(svg(p))).resize(1200, 630).png({ compressionLevel: 9 }).toFile(png);
    console.log(p.slug + '.png', Math.round(fs.statSync(png).size / 1024) + 'KB');
  }
})();
