/**
 * lead-submit.mjs — POST /api/lead-submit
 *
 * Contact / lead form endpoint. Public, no auth. Emails the LO team
 * via Resend using the same infrastructure the loan-tools app uses
 * (RESEND_API_KEY, noreply@leads.slacapital.com from address).
 *
 * Body: { name, email, phone?, message?, source? }
 *
 * Response 200: { ok: true }
 * Response 400: { error: '...' } for validation failures
 * Response 500: { error: '...' } if Resend fails
 */

const MAX_BYTES = 8 * 1024;

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const cl = req.headers.get('content-length');
  if (cl && parseInt(cl, 10) > MAX_BYTES) return json(413, { error: 'Payload too large' });

  let body;
  try { body = await req.json(); }
  catch { return json(400, { error: 'Invalid JSON' }); }

  const name    = String((body && body.name)    || '').trim().slice(0, 120);
  const email   = String((body && body.email)   || '').trim().toLowerCase().slice(0, 160);
  const phone   = String((body && body.phone)   || '').trim().slice(0, 40);
  const message = String((body && body.message) || '').trim().slice(0, 2000);
  const source  = String((body && body.source)  || '').trim().slice(0, 60);
  // Referral-partner fields (partner pages generated from data/partners.json).
  // ref = partner slug (matches the ?ref= the portal captures on apply.html),
  // tag = human-readable label the LO sees on the prospect ("EBL Referral").
  const ref      = String((body && body.ref)      || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
  const tag      = String((body && body.tag)      || '').trim().slice(0, 60);
  const loanType = String((body && body.loanType) || '').trim().slice(0, 60);

  if (!name) return json(400, { error: 'Name required' });
  if (!email || !email.includes('@')) return json(400, { error: 'Valid email required' });

  // ── Portal sync (referral leads only) ─────────────────────────────
  // Creates a real prospect in the loan-tools portal via its PUBLIC
  // prospects-save endpoint, tagged with the partner ref — same field the
  // portal captures from ?ref= on apply.html (Deploy 236.464), so both
  // paths attribute identically. Runs BEFORE the email so a Resend outage
  // can't lose the lead. Non-fatal: email still goes out if this fails.
  let portalSynced = false;
  if (ref || tag) {
    const parts = name.split(/\s+/);
    const firstName = parts.shift() || '';
    const lastName = parts.join(' ');
    const LOAN_MAP = {
      'DSCR rental': 'DSCR',
      'Fix & Flip': 'Fix & Flip',
      'New construction': 'New Construction',
      'Portfolio / multiple properties': 'DSCR',
      'Not sure yet': '',
    };
    const prospectBody = JSON.stringify({
      email, firstName, lastName, phone,
      ref,
      submitterType: 'borrower',
      loanProduct: LOAN_MAP[loanType] !== undefined ? LOAN_MAP[loanType] : loanType,
      projectDescription: (tag ? tag + ' — ' : '') +
        'Submitted via the slacapital.ai/' + ref + '/ partner referral page.' +
        (message ? '\n\n' + message : ''),
    });
    // Two attempts: the portal's heavy functions can 502 on the first
    // post-deploy cold-start request (known behavior, fine when warm).
    for (let attempt = 1; attempt <= 2 && !portalSynced; attempt++) {
      try {
        const r = await fetch('https://portal.slacapital.ai/api/prospects-save', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: prospectBody,
          signal: AbortSignal.timeout(9000),
        });
        portalSynced = r.ok;
        if (!r.ok) {
          console.warn(`lead-submit: portal sync attempt ${attempt} -> ${r.status}`);
          if (attempt === 1) await new Promise(res => setTimeout(res, 1500));
        }
      } catch (e) {
        console.warn(`lead-submit: portal sync attempt ${attempt} error:`, e && e.message);
        if (attempt === 1) await new Promise(res => setTimeout(res, 1500));
      }
    }
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('lead-submit: RESEND_API_KEY not set — lead not emailed:', { name, email, phone });
    if (portalSynced) return json(200, { ok: true, portalSynced, emailed: false });
    return json(500, { error: 'Email is not configured. Please email apply@slacapital.com directly.' });
  }

  const to = process.env.LEAD_INBOX || 'apply@slacapital.com';
  const from = process.env.LEAD_FROM || 'SLA Capital <noreply@leads.slacapital.com>';

  const subject = `New lead — ${name}` + (tag ? ` [${tag}]` : source ? ` (${source})` : '');
  const text = [
    'New lead from slacapital.ai',
    '',
    `Name:    ${name}`,
    `Email:   ${email}`,
    `Phone:   ${phone || '(not provided)'}`,
    `Source:  ${source || '(unknown)'}`,
    tag ? `Tag:     ${tag}` : null,
    (ref || tag) ? `Portal:  ${portalSynced ? 'prospect created in pipeline ✓' : 'SYNC FAILED — enter manually'}` : null,
    '',
    'Message:',
    message || '(none)',
  ].filter(l => l !== null).join('\n');
  const html =
    '<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;background:#F2F2F2;padding:32px 16px">' +
      '<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;padding:28px 32px;color:#000">' +
        '<h1 style="font-family:\'Roboto Slab\',Georgia,serif;color:#281D28;font-size:22px;margin:0 0 8px 0">New lead — slacapital.ai</h1>' +
        `<p style="margin:0 0 20px;color:#6b6470;font-size:13px">Submitted ${esc(new Date().toISOString())}</p>` +
        `<p style="margin:0 0 8px"><strong>Name:</strong> ${esc(name)}</p>` +
        `<p style="margin:0 0 8px"><strong>Email:</strong> <a href="mailto:${esc(email)}">${esc(email)}</a></p>` +
        `<p style="margin:0 0 8px"><strong>Phone:</strong> ${esc(phone) || '<span style="color:#6b6470">not provided</span>'}</p>` +
        `<p style="margin:0 0 8px"><strong>Source:</strong> ${esc(source) || '<span style="color:#6b6470">unknown</span>'}</p>` +
        (tag ? `<p style="margin:0 0 8px"><strong>Tag:</strong> <span style="background:#FFBC7D;color:#281D28;padding:2px 10px;border-radius:10px;font-weight:600">${esc(tag)}</span></p>` : '') +
        ((ref || tag) ? `<p style="margin:0 0 20px"><strong>Portal:</strong> ${portalSynced ? 'prospect created in pipeline &#10003;' : '<span style="color:#7c1f1f;font-weight:600">SYNC FAILED — enter manually</span>'}</p>` : '<p style="margin:0 0 12px"></p>') +
        '<h4 style="margin:0 0 4px;font-family:\'Roboto Slab\',Georgia,serif;color:#281D28">Message</h4>' +
        `<div style="white-space:pre-wrap;background:#F2F2F2;padding:12px 14px;border-radius:6px;font-size:14px">${esc(message) || '<em style="color:#6b6470">no message</em>'}</div>` +
      '</div>' +
    '</body></html>';

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, text, html, reply_to: email }),
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      console.error('lead-submit: Resend', resp.status, t.slice(0, 400));
      // Referral leads already live in the portal pipeline — don't show
      // the borrower an error over a notification-email failure.
      if (portalSynced) return json(200, { ok: true, portalSynced, emailed: false });
      return json(502, { error: 'Email send failed. Please try again in a moment.' });
    }
  } catch (e) {
    console.error('lead-submit error:', e);
    if (portalSynced) return json(200, { ok: true, portalSynced, emailed: false });
    return json(500, { error: 'Email send failed: ' + ((e && e.message) || 'unknown') });
  }

  return json(200, { ok: true, portalSynced });
};
