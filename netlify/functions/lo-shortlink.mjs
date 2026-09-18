/**
 * lo-shortlink.mjs — slacapital.ai/a/<name>  →  /apply/?lo=<name>@slacapital.com
 *
 * 2026-09-18 (Mike: "it would be nice if they had an easier way to send an
 * apply link that defaults to them without having to send the long custom
 * link"). The canonical personal link is
 *   https://slacapital.ai/apply/?lo=jeremy%40slacapital.com   (54 characters)
 * which is ugly in a text message and dense as a QR code. This gives every rep
 *   https://slacapital.ai/a/jeremy                            (30 characters)
 * which is short enough to say out loud and prints as a low-density QR.
 *
 * The slug is the mailbox part of the rep's work address; the routing itself is
 * unchanged (apply.html keeps taking ?lo=<email>, and prospects-save resolves
 * the owner from it). An unknown slug still lands on the application — it just
 * routes to the house account for triage, which is what an unrouted lead does
 * anyway. Nothing here can create or leak a record.
 */
const DOMAIN = 'slacapital.com';
const APPLY = 'https://slacapital.ai/apply/';

export default async (req) => {
  const url = new URL(req.url);
  // /a/jeremy  or  /a/jeremy/  →  "jeremy"
  const slug = decodeURIComponent(url.pathname.replace(/^\/a\/?/, '').replace(/\/+$/, '')).trim().toLowerCase();

  // Mailbox-safe only: letters, digits, dot, dash, underscore, plus.
  const target = /^[a-z0-9._+-]{1,64}$/.test(slug)
    ? APPLY + '?lo=' + encodeURIComponent(slug + '@' + DOMAIN)
    : APPLY;

  // Carry any extra query through (e.g. ?ref= from a campaign).
  const extra = url.searchParams.toString();
  const to = extra ? target + (target.includes('?') ? '&' : '?') + extra : target;

  return new Response(null, {
    status: 302,
    headers: { Location: to, 'Cache-Control': 'public, max-age=300' },
  });
};
