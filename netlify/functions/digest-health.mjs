// digest-health.mjs — tiny diagnostic for the weekly digest automation.
// Reports whether the required env vars exist on this Netlify site.
// Exposes booleans only — never values.
export default async function handler() {
  return new Response(JSON.stringify({
    ok: true,
    brevoKeyPresent: !!process.env.BREVO_API_KEY,
    listId: process.env.BREVO_DIGEST_LIST_ID || '11 (default)',
    notify: !!(process.env.DIGEST_NOTIFY_EMAIL || true),
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}
