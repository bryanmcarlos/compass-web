export type SendSmsResult = { ok: true } | { ok: false; error: string };

/** Sends via Twilio's plain REST API (no SDK dependency needed — it's a
 * single form-encoded POST with Basic Auth). Swapping providers later (e.g.
 * Unifonic) only means rewriting this one function; nothing that calls
 * `sendSms` needs to change.
 *
 * Returns a result rather than throwing — a missing/failed SMS should never
 * take down a caller that's processing a whole batch of drives/recipients,
 * it should just get logged and skipped. */
export async function sendSms(to: string, message: string): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn(
      `[sms] Not configured (missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER) — skipped SMS to ${to}.`,
    );
    return { ok: false, error: "SMS provider not configured" };
  }

  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const body = new URLSearchParams({ To: to, From: fromNumber, Body: message });

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`[sms] Twilio error sending to ${to}:`, res.status, errorBody);
      return { ok: false, error: `Twilio responded ${res.status}` };
    }

    return { ok: true };
  } catch (err) {
    console.error(`[sms] Failed to send to ${to}:`, err);
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
