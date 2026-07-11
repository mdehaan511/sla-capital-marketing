#!/usr/bin/env node
/**
 * generate-sitemap.mjs — build sitemap.xml from data/states.json
 * plus a static list of core pages.
 *
 *   node scripts/generate-sitemap.mjs
 *
 * Output: /sitemap.xml at the repo root, served as-is by Netlify.
 *
 * Priorities (Google is documented to mostly ignore these, but it
 * doesn't hurt to signal intent to smaller crawlers + LLM indexers):
 *   Homepage             1.0
 *   Product hubs         0.9
 *   State pages          0.7
 *   Blog posts           0.6
 *   Blog index           0.5
 *   Static (apply, etc)  0.4
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const STATES_PATH = path.join(REPO_ROOT, 'data', 'states.json');
const OUT = path.join(REPO_ROOT, 'sitemap.xml');
const BASE = 'https://slacapital.ai';

const raw = fs.readFileSync(STATES_PATH, 'utf8');
const { states } = JSON.parse(raw);

const PRODUCT_SLUGS = ['rental', 'fix-n-flip', 'new-construction'];
const BLOG_POSTS = [
  'dscr-loans-explained',
  'arv-fix-and-flip-explained',
  'dscr-cash-out-seasoning',
];

const today = new Date().toISOString().slice(0, 10);

const urls = [];

// Homepage
urls.push({ loc: '/', priority: '1.0', changefreq: 'weekly', lastmod: today });

// Product hubs
for (const slug of PRODUCT_SLUGS) {
  urls.push({ loc: `/${slug}/`, priority: '0.9', changefreq: 'weekly', lastmod: today });
}

// State pages — 41 × 3 = 123
for (const slug of PRODUCT_SLUGS) {
  for (const state of states) {
    urls.push({ loc: `/${slug}/${state.slug}/`, priority: '0.7', changefreq: 'monthly', lastmod: today });
  }
}

// Blog index + posts
urls.push({ loc: '/blog/', priority: '0.5', changefreq: 'weekly', lastmod: today });
for (const post of BLOG_POSTS) {
  urls.push({ loc: `/blog/${post}/`, priority: '0.6', changefreq: 'monthly', lastmod: today });
}

// Static / legal / careers / apply
urls.push({ loc: '/apply/',           priority: '0.6', changefreq: 'monthly', lastmod: today });
urls.push({ loc: '/current-jobs/',    priority: '0.4', changefreq: 'monthly', lastmod: today });
urls.push({ loc: '/privacy-policy/',  priority: '0.3', changefreq: 'yearly',  lastmod: today });

// Build XML
const body = urls.map(u => `  <url>
    <loc>${BASE}${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

fs.writeFileSync(OUT, xml);
console.log(`✓ sitemap.xml written with ${urls.length} URLs -> ${OUT}`);
