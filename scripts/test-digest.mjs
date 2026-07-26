#!/usr/bin/env node
// test-digest.mjs — dry-run the weekly digest locally.
// Creates a DRAFT campaign in Brevo (never sends to the list) and delivers
// the preview + review-notice emails, exactly like a real Monday run.
//
//   BREVO_API_KEY=... node scripts/test-digest.mjs
// or: set -a; . ~/.config/sla/brevo.env; set +a; node scripts/test-digest.mjs

import { prepareDigest } from '../netlify/functions/digest-prepare.mjs';

const apiKey = process.env.BREVO_API_KEY;
if (!apiKey) { console.error('BREVO_API_KEY not set'); process.exit(1); }

const result = await prepareDigest({
  apiKey,
  listId: parseInt(process.env.BREVO_DIGEST_LIST_ID || '11', 10),
  notifyEmail: process.env.DIGEST_NOTIFY_EMAIL || 'mdehaan51@gmail.com',
  dryRun: true,
});
console.log(JSON.stringify(result, null, 2));
