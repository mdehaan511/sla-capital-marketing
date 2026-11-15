#!/usr/bin/env node
/**
 * sync-dscr-floor.mjs — keep the published DSCR "starting at" rate in
 * lockstep with the portal's live DSCR pricing sheet.
 *
 *   node scripts/sync-dscr-floor.mjs          # apply
 *   node scripts/sync-dscr-floor.mjs --check  # report only, change nothing
 *
 * Policy (Mike, 2026-09-12): the marketing DSCR from-rate IS the sheet's
 * floor pricing BEFORE any rate buy-down, published with the note
 * "*Before Buy Down". This intentionally supersedes the older
 * "published rates are set manually" rule — for the DSCR from-rate only.
 * Fix & Flip and New Construction floors remain manually set.
 *
 * Floor definition (simplified per Mike 2026-09-12 — matches the note
 * exactly: before buy-down, highest credit tier, DSCR 1.20+):
 *   baseRate["30Y Fixed"]
 *   + best fico["780+"] adjustment (most favorable column)
 *   + best dscr["1.20+"] adjustment
 *   ... assuming 0% TPO (Mike 9/12 — the TPO premium changes regularly,
 *   so it stays OUT of the published number), NO rateBuydown (the
 *   "*Before Buy Down" qualifier), and NO prepay/UPB assumptions —
 *   nothing is in the number that isn't in the note.
 *
 * On change: sweeps the old from-rate string across the site's html/json/
 * txt/mjs files, refreshes rates.json (rate, range floor, effectiveDate,
 * note), regenerates /rates/, and lists any social SVG/PNG artwork that
 * still carries the old number (those need a re-render under a NEW
 * filename — never overwrite card artwork in place, it's immutable-cached).
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = path.resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');
const NOTE = '*Before Buy Down · Highest Credit Tier · DSCR 1.20+';
// 2026-11-15: the portal applies DIYA sheets as live DATA (portal Deploy 237.871),
// so the constants baked into the served dscr-pricing.js froze on the 10/29 sheet
// and this script, which parsed that file, kept publishing a stale floor. It now
// reads the portal's public endpoint (portal Deploy 237.1103), which loads the
// live sheet and applies the same formula as above. A 'baked' answer means the
// live sheet didn't load; publishing it could roll the site back, so we abort.
const SRC_URL = 'https://portal.slacapital.ai/api/public-dscr-floor';

let F;
try { F = await (await fetch(SRC_URL, { cache: 'no-store' })).json(); }
catch (e) { console.error('SYNC ABORT: could not read ' + SRC_URL + ': ' + (e && e.message)); process.exit(2); }
if (!F || F.source !== 'live') {
  console.error(`SYNC ABORT: portal answered source=${F && F.source} (live sheet not loaded) — not publishing a fallback rate.`);
  process.exit(2);
}
const floorRaw = Number(F.floor);
const floor = Math.round(floorRaw * 100) / 100;
if (!(floor > 3 && floor < 13)) {
  console.error(`SYNC ABORT: floor ${floor} outside sanity bounds (3-13).`);
  process.exit(2);
}
const newRate = floor.toFixed(2) + '%';
const D = { effectiveDate: F.sheet || F.effective || '' };

// Sheet effective date -> ISO for rates.json (the portal's Pacific go-live day when given)
const ed = F.effective ? new Date(F.effective + 'T00:00:00Z') : new Date(D.effectiveDate + ' UTC');
const edIso = isNaN(ed) ? null : ed.toISOString().slice(0, 10);

const ratesPath = path.join(R, 'data', 'rates.json');
const rates = JSON.parse(fs.readFileSync(ratesPath, 'utf8'));
const rental = rates.products.find(p => p.slug === 'rental');
const oldRate = rental.rateFrom.replace('*', '');

console.log(`sheet: ${D.effectiveDate} | computed no-buydown floor: ${floorRaw.toFixed(3)} -> publish ${newRate} | currently published: ${oldRate}`);

const noteCurrent = rental.rateNote === NOTE;
if (oldRate === newRate && noteCurrent) { console.log('NO CHANGE'); process.exit(0); }
if (CHECK) { console.log(`CHANGE NEEDED: ${oldRate} -> ${newRate}${noteCurrent ? '' : ' (+note)'}`); process.exit(0); }

// 1. rates.json: from-rate, range floor, note, effective date.
rental.rateFrom = newRate;
rental.rateNote = NOTE;
rental.rateRange = rental.rateRange.replace(oldRate, newRate);
if (edIso) rates.effectiveDate = edIso;
fs.writeFileSync(ratesPath, JSON.stringify(rates, null, 2) + '\n');

// 2. Site-wide sweep of the old rate string (text surfaces only).
const EXT = new Set(['.html', '.json', '.txt', '.mjs']);
let files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (EXT.has(path.extname(e.name))) files.push(p);
  }
})(R);
let changed = 0;
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(oldRate)) continue;
  fs.writeFileSync(f, s.split(oldRate).join(newRate));
  changed++;
}

// 2b. Server-rendered "Rates current as of <date>" stamps (e.g. /brokers/), so
//     crawlers and no-JS readers see the same date the page's script shows.
if (edIso) {
  const asOf = new Date(edIso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  for (const f of files) {
    if (!f.endsWith('.html')) continue;
    const s = fs.readFileSync(f, 'utf8');
    const out = s.replace(/(<span id="ratesAsOf">)[^<]*(<\/span>)/g, `$1${asOf}$2`);
    if (out !== s) fs.writeFileSync(f, out);
  }
}

// 3. Regenerate the rates page from the updated rates.json.
execSync('node ' + path.join(R, 'scripts', 'generate-rates-page.mjs'), { stdio: 'inherit' });

// 4. Flag baked artwork that still shows the old number (needs manual
//    re-render under a NEW filename; never overwritten automatically).
const stale = [];
(function scan(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) scan(p);
    else if (e.name.endsWith('.svg') && fs.readFileSync(p, 'utf8').includes(oldRate)) stale.push(path.relative(R, p));
  }
})(path.join(R, 'assets'));

console.log(`UPDATED: ${oldRate} -> ${newRate} in ${changed} files; rates.json effectiveDate ${rates.effectiveDate}; note set.`);
if (stale.length) console.log('STALE ARTWORK (re-render under new filenames before reuse): ' + stale.join(', '));
