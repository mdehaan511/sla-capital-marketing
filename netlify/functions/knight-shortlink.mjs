/**
 * knight-shortlink.mjs — slacapital.ai/k/<slug>  →  https://portal.slacapital.ai/knight/<slug>
 *
 * 2026-11-02 (Mike: the Knights of the Realm referral program). Every Knight has a tracked link on the portal; this
 * gives them the short, sayable form for texts, QR codes and meetup slides. The slug is the Knight's portal slug
 * (letters, digits, dashes); anything else lands on the petition page. The query string rides along (?i=<invite>).
 * Nothing here can create or leak a record: the portal records the click and sets the cookie.
 */
const PORTAL = 'https://portal.slacapital.ai';

export default async (req) => {
  const url = new URL(req.url);
  const slug = decodeURIComponent(url.pathname.replace(/^\/k\/?/, '').replace(/\/+$/, '')).trim().toLowerCase();
  const target = /^[a-z0-9-]{1,40}$/.test(slug) ? PORTAL + '/knight/' + slug : PORTAL + '/knights-join';
  const extra = url.searchParams.toString();
  const to = extra ? target + '?' + extra : target;
  return new Response(null, { status: 302, headers: { Location: to, 'Cache-Control': 'no-store' } });
};
