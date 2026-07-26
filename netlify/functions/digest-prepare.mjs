// digest-prepare.mjs — weekly Brevo digest for the SLA Borrowers list.
//
// Runs every MONDAY 16:00 UTC (9am PDT) via the schedule in netlify.toml.
// Flow: build digest HTML from the live site's posts.json + rates.json,
// create a Brevo campaign scheduled for TUESDAY 16:00 UTC, then email a
// preview + review notice to NOTIFY_EMAIL. Mike has ~24h to cancel or edit
// the campaign in Brevo (Campaigns → the queued digest → Unschedule).
//
// Idempotent: if a campaign named for this Tuesday already exists, it skips.
//
// Env (set on the Netlify marketing site):
//   BREVO_API_KEY          — required
//   BREVO_DIGEST_LIST_ID   — optional, defaults to 11 (SLA Borrowers)
//   DIGEST_NOTIFY_EMAIL    — optional, defaults to mdehaan51@gmail.com

const SITE = 'https://slacapital.ai';
const BREVO = 'https://api.brevo.com/v3';
const SENDER = { name: 'SLA Capital', email: 'apply@slacapital.com' };

function nextTuesday1600Utc(from) {
  const d = new Date(from.getTime());
  d.setUTCHours(16, 0, 0, 0);
  while (d.getUTCDay() !== 2 || d <= from) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

async function brevo(apiKey, method, path, body) {
  const res = await fetch(BREVO + path, {
    method,
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
  if (!res.ok) throw new Error(`Brevo ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return json;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Email-safe (table + inline styles) digest HTML in site brand colors.
export function buildDigestHtml({ newPosts, featured, rates, tuesday }) {
  const dateStr = tuesday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

  const postBlock = (p, label) => `
    <tr><td style="padding:0 32px 8px">
      <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#DA7238">${esc(label)} · ${esc(p.category)}</div>
    </td></tr>
    <tr><td style="padding:0 32px 6px">
      <a href="${SITE}/blog/${p.slug}/?utm_source=brevo&amp;utm_medium=email&amp;utm_campaign=weekly-digest" style="font-size:20px;font-weight:700;color:#281D28;text-decoration:none">${esc(p.title)}</a>
    </td></tr>
    <tr><td style="padding:0 32px 24px;font-size:15px;line-height:1.6;color:#6b6470">${esc(p.description)}
      <br><a href="${SITE}/blog/${p.slug}/?utm_source=brevo&amp;utm_medium=email&amp;utm_campaign=weekly-digest" style="color:#DA7238;font-weight:600">Read the guide →</a>
    </td></tr>`;

  const newSection = newPosts.length
    ? newPosts.map(p => postBlock(p, 'New this week')).join('')
    : postBlock(featured, 'Featured guide');

  const rateRows = rates.products.map(p => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #E0DCDC;font-size:14px;color:#281D28;font-weight:600">${esc(p.shortName)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E0DCDC;font-size:14px;color:#DA7238;font-weight:700;white-space:nowrap">from ${esc(p.rateFrom)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E0DCDC;font-size:13px;color:#6b6470">${esc(p.closeTime)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F2F2F2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F2F2"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:12px;overflow:hidden;font-family:Roboto,'Segoe UI',Arial,sans-serif">

  <tr><td style="background:#281D28;padding:24px 32px" align="left">
    <!-- logo-alt = white-lettered variant; logo.png is invisible on the dark header -->
    <img src="${SITE}/assets/logo-alt.png" alt="SLA Capital" height="40" style="height:40px;width:auto;display:block" />
  </td></tr>

  <tr><td style="padding:32px 32px 8px">
    <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#6b6470">The SLA Capital Weekly · ${esc(dateStr)}</div>
  </td></tr>
  <tr><td style="padding:0 32px 24px;font-size:15px;line-height:1.6;color:#281D28">
    Straight answers for real estate investors — no fluff, no bait-and-switch. Here's this week's read and where our rates stand.
  </td></tr>

  ${newSection}

  <tr><td style="padding:0 32px 12px">
    <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#DA7238">Current rates</div>
  </td></tr>
  <tr><td style="padding:0 32px 8px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E0DCDC;border-radius:8px">
      ${rateRows}
    </table>
  </td></tr>
  <tr><td style="padding:0 32px 28px;font-size:12px;color:#6b6470">
    Effective ${esc(rates.effectiveDate)} · ${esc(rates.shared.pricingBasis)} · <a href="${SITE}/rates/?utm_source=brevo&amp;utm_medium=email&amp;utm_campaign=weekly-digest" style="color:#DA7238">Full rate sheet →</a>
  </td></tr>

  <tr><td align="center" style="padding:0 32px 36px">
    <a href="${SITE}/apply/?utm_source=brevo&amp;utm_medium=email&amp;utm_campaign=weekly-digest" style="display:inline-block;background:#DA7238;color:#FFFFFF;font-size:16px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px">Get Qualified in Minutes</a>
    <div style="font-size:13px;color:#6b6470;margin-top:10px">Real term sheet, no obligation — or just reply to this email with your deal.</div>
  </td></tr>

  <tr><td style="background:#281D28;padding:24px 32px;font-size:12px;line-height:1.7;color:rgba(255,255,255,0.65)">
    SLA Capital — a Sir Lends A Lot LLC Company · 707 W Main Ave #31, Spokane, WA 99201<br>
    Sir Lends A Lot LLC · NMLS ID #2863552 · <a href="https://www.nmlsconsumeraccess.org/EntityDetails.aspx/COMPANY/2863552" style="color:rgba(255,255,255,0.85)">NMLS Consumer Access</a><br>
    Certified Member — American Association of Private Lenders (AAPL)<br>
    Business-purpose loans only. Rates shown are floors for qualified borrowers; your quote may differ.<br><br>
    You're receiving this because you've worked with or inquired with SLA Capital.
    <a href="{{ unsubscribe }}" style="color:rgba(255,255,255,0.85)">Unsubscribe</a>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

export async function prepareDigest({ apiKey, listId, notifyEmail, dryRun = false, now = new Date() }) {
  const [postsRes, ratesRes] = await Promise.all([
    fetch(`${SITE}/data/posts.json`),
    fetch(`${SITE}/data/rates.json`),
  ]);
  const { posts } = await postsRes.json();
  const rates = await ratesRes.json();

  const weekAgo = new Date(now.getTime() - 7 * 864e5);
  const newPosts = posts.filter(p => new Date(p.datePublished + 'T00:00:00Z') > weekAgo);

  // Featured rotation: cycle through the catalog by week number so repeat
  // sends don't repeat content back-to-back.
  const weekNum = Math.floor(now.getTime() / (7 * 864e5));
  const featured = posts[weekNum % posts.length];

  const tuesday = nextTuesday1600Utc(now);
  const tuesdayIso = tuesday.toISOString().slice(0, 10);
  const name = dryRun ? `TEST — Weekly Digest (safe to delete)` : `Weekly Digest — ${tuesdayIso}`;

  // Idempotency: bail if this Tuesday's campaign already exists.
  if (!dryRun) {
    const existing = await brevo(apiKey, 'GET', '/emailCampaigns?limit=50&sort=desc');
    if ((existing.campaigns || []).some(c => c.name === name)) {
      return { skipped: true, reason: `campaign "${name}" already exists` };
    }
  }

  const lead = newPosts[0] || featured;
  const subject = newPosts.length
    ? `New investor guide: ${lead.title}`
    : `${lead.title} — plus current rates`;

  const htmlContent = buildDigestHtml({ newPosts, featured, rates, tuesday });

  const campaign = await brevo(apiKey, 'POST', '/emailCampaigns', {
    name,
    subject,
    sender: SENDER,
    type: 'classic',
    htmlContent,
    recipients: { listIds: [listId] },
    replyTo: SENDER.email,
    // dryRun: leave as a draft (never sends). Real run: schedule for Tuesday.
    ...(dryRun ? {} : { scheduledAt: tuesday.toISOString() }),
  });

  // Preview: Brevo renders the real campaign to the reviewer's inbox.
  let previewSent = true;
  try {
    await brevo(apiKey, 'POST', `/emailCampaigns/${campaign.id}/sendTest`, { emailTo: [notifyEmail] });
  } catch (e) {
    previewSent = false;
    console.log('[digest] sendTest failed (non-fatal):', e.message);
  }

  // Review notice via transactional email — always goes through.
  await brevo(apiKey, 'POST', '/smtp/email', {
    sender: SENDER,
    to: [{ email: notifyEmail }],
    subject: dryRun
      ? `[TEST] Weekly digest draft created — review in Brevo`
      : `Review: weekly digest sends Tuesday (${tuesdayIso})`,
    htmlContent: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#281D28">
      <p><strong>${dryRun ? 'TEST draft created — it will NOT send.' : `The weekly digest is queued to send Tuesday ${tuesdayIso} at 16:00 UTC (9am PT).`}</strong></p>
      <p>Subject: <em>${esc(subject)}</em><br>
      Audience: list #${listId} (SLA Borrowers)<br>
      Content: ${newPosts.length ? `${newPosts.length} new post(s)` : `featured guide "${esc(featured.title)}"`} + current rates.</p>
      <p>${previewSent ? 'A preview of the exact email was sent to you separately.' : 'Preview send failed — open the campaign in Brevo to review it.'}</p>
      <p>To change or cancel: <a href="https://my.brevo.com/camp/lists/list">open Brevo → Campaigns</a>, find "${esc(name)}", and edit or unschedule it. Do nothing and it ${dryRun ? 'stays a draft' : 'sends as scheduled'}.</p>
    </div>`,
  });

  return { skipped: false, campaignId: campaign.id, name, subject, scheduledAt: dryRun ? null : tuesday.toISOString(), previewSent };
}

export default async function handler() {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.log('[digest] BREVO_API_KEY missing — aborting');
    return new Response(JSON.stringify({ error: 'BREVO_API_KEY not configured' }), { status: 500 });
  }
  const listId = parseInt(process.env.BREVO_DIGEST_LIST_ID || '11', 10);
  const notifyEmail = process.env.DIGEST_NOTIFY_EMAIL || 'mdehaan51@gmail.com';

  try {
    const result = await prepareDigest({ apiKey, listId, notifyEmail });
    console.log('[digest] result:', JSON.stringify(result));
    return new Response(JSON.stringify(result), { status: 200 });
  } catch (e) {
    console.log('[digest] FAILED:', e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
