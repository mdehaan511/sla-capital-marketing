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

  if (!name) return json(400, { error: 'Name required' });
  if (!email || !email.includes('@')) return json(400, { error: 'Valid email required' });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('lead-submit: RESEND_API_KEY not set — dropping lead:', { name, email, phone });
    return json(500, { error: 'Email is not configured. Please email apply@slacapital.com directly.' });
  }

  const to = process.env.LEAD_INBOX || 'apply@slacapital.com';
  const from = process.env.LEAD_FROM || 'SLA Capital <noreply@leads.slacapital.com>';

  const subject = `New lead — ${name}` + (source ? ` (${source})` : '');
  const text = [
    'New lead from slacapital.ai',
    '',
    `Name:    ${name}`,
    `Email:   ${email}`,
    `Phone:   ${phone || '(not provided)'}`,
    `Source:  ${source || '(unknown)'}`,
    '',
    'Message:',
    message || '(none)',
  ].join('\n');
  const html =
    '<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;background:#F2F2F2;padding:32px 16px">' +
      '<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;padding:28px 32px;color:#000">' +
        '<h1 style="font-family:\'Roboto Slab\',Georgia,serif;color:#281D28;font-size:22px;margin:0 0 8px 0">New lead — slacapital.ai</h1>' +
        `<p style="margin:0 0 20px;color:#6b6470;font-size:13px">Submitted ${esc(new Date().toISOString())}</p>` +
        `<p style="margin:0 0 8px"><strong>Name:</strong> ${esc(name)}</p>` +
        `<p style="margin:0 0 8px"><strong>Email:</strong> <a href="mailto:${esc(email)}">${esc(email)}</a></p>` +
        `<p style="margin:0 0 8px"><strong>Phone:</strong> ${esc(phone) || '<span style="color:#6b6470">not provided</span>'}</p>` +
        `<p style="margin:0 0 20px"><strong>Source:</strong> ${esc(source) || '<span style="color:#6b6470">unknown</span>'}</p>` +
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
      return json(502, { error: 'Email send failed. Please try again in a moment.' });
    }
  } catch (e) {
    console.error('lead-submit error:', e);
    return json(500, { error: 'Email send failed: ' + ((e && e.message) || 'unknown') });
  }

  return json(200, { ok: true });
};
