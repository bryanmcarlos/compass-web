/** The one canonical place this app's own absolute URL is defined — used
 * anywhere a link needs to work outside the app's own origin (an SMS/email/
 * WhatsApp message, a cron job's own reminder text). `compass-web-beige`,
 * not `compass-web` — the actual deployed domain, confirmed directly
 * against the live site, not assumed. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://compass-web-beige.vercel.app";
