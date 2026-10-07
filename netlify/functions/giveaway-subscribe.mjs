/**
 * giveaway-subscribe.mjs — POST /api/giveaway-subscribe
 *
 * Email capture for the social gift-card giveaway (/giveaway/). Public, no
 * auth. Adds the contact to the Brevo digest list (BREVO_DIGEST_LIST_ID,
 * default 11) with GIVEAWAY attributes so the monthly drawing can filter to
 * entrants. An already-subscribed email is a success ("you're entered"), not
 * an error — Brevo updateEnabled handles the upsert.
 *
 * Body: { email, name?, source?, hp? }  — hp is a honeypot; bots filling it
 * get a fake 200 and no contact.
 *
 * Response 200: { ok: true }
 * Response 400/500: { error: '...' }
 */

const MAX_BYTES = 4 * 1024;

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

  const email  = String((body && body.email)  || '').trim().toLowerCase().slice(0, 160);
  const name   = String((body && body.name)   || '').trim().slice(0, 120);
  const source = String((body && body.source) || 'giveaway-page').trim().slice(0, 60);
  const hp     = String((body && body.hp)     || '').trim();

  // Honeypot: real users never fill this hidden field.
  if (hp) return json(200, { ok: true });

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { error: 'A valid email is required' });
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error('giveaway-subscribe: BREVO_API_KEY not set');
    return json(500, { error: 'Signup is temporarily unavailable. Email apply@slacapital.com and we will enter you manually.' });
  }
  const listId = parseInt(process.env.BREVO_DIGEST_LIST_ID || '11', 10);

  const firstName = name.split(/\s+/)[0] || '';
  const payload = {
    email,
    updateEnabled: true,
    listIds: [listId],
    attributes: {
      GIVEAWAY: 'yes',
      GIVEAWAY_SOURCE: source,
      GIVEAWAY_ENTERED: new Date().toISOString().slice(0, 10),
      ...(firstName ? { FIRSTNAME: firstName } : {}),
    },
  };

  try {
    const resp = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(9000),
    });
    // 201 = created, 204 = updated existing contact. Both mean "entered".
    if (resp.status === 201 || resp.status === 204) return json(200, { ok: true });
    const t = await resp.text().catch(() => '');
    // Brevo duplicate_parameter can surface even with updateEnabled — still entered.
    if (t.includes('duplicate_parameter')) return json(200, { ok: true });
    console.error('giveaway-subscribe: Brevo', resp.status, t.slice(0, 300));
    return json(502, { error: 'Signup failed. Please try again in a moment.' });
  } catch (e) {
    console.error('giveaway-subscribe error:', e && e.message);
    return json(500, { error: 'Signup failed. Please try again in a moment.' });
  }
};
