import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSms } from "@/lib/sms";
import { SITE_URL } from "@/lib/siteUrl";

// UAE, no DST — matches every timestamp in this club's own historical trip
// report data ("GMT 4"). drives.drive_date / drive_end_time are stored as
// club-local wall-clock values with no timezone of their own.
const CLUB_UTC_OFFSET_HOURS = 4;

/** Builds the UTC instant a drive's end time falls at, without depending on
 * the runtime's ambient timezone (Date.UTC is used explicitly rather than
 * `new Date("...")` on a bare timestamp, which is interpreted in whatever
 * timezone the process happens to be running in). */
function driveEndsAtUtc(driveDate: string, driveEndTime: string | null): Date {
  const [year, month, day] = driveDate.split("-").map(Number);
  const [hours, minutes, seconds] = (driveEndTime ?? "23:59:59").split(":").map(Number);
  const utcMillis = Date.UTC(
    year,
    month - 1,
    day,
    hours - CLUB_UTC_OFFSET_HOURS,
    minutes,
    seconds ?? 0,
  );
  return new Date(utcMillis);
}

type ScheduledDrive = {
  id: string;
  title: string;
  drive_date: string;
  drive_end_time: string | null;
};

type RegistrationRow = {
  user: { full_name: string | null; username: string; mobile_number: string | null } | null;
};

/**
 * Intended to be called only by Vercel Cron (see vercel.json) on a
 * schedule — not part of any user-facing flow. Flips a drive's status to
 * Completed once its end time has passed, then texts every registrant a
 * trip-report reminder.
 *
 * "Checked-in drivers" from the spec doesn't map to anything this app
 * tracks — there's no check-in flow anywhere in the codebase. Every
 * registrant (Driver/Support/Lead) gets notified instead, since that's the
 * only real attendance signal that exists.
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY (bulk-updates drives and reads every
 * registrant's phone number across the whole roster — not a single user's
 * RLS-scoped session) and CRON_SECRET (this route's own bearer token,
 * checked against the Authorization header Vercel Cron sends automatically
 * once CRON_SECRET is set as a project env var — fails closed if unset).
 * Actual SMS delivery additionally needs TWILIO_ACCOUNT_SID /
 * TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER (see src/lib/sms.ts) — none of
 * which exist in this project yet, so drives will auto-complete correctly
 * but no text messages will actually send until those are added.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error("CRON ERROR [complete-drives]: SUPABASE_SERVICE_ROLE_KEY is not set.");
    return NextResponse.json(
      { error: "Server not configured (missing service role key)" },
      { status: 500 },
    );
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: scheduledDrives, error: drivesError } = await supabase
    .from("drives")
    .select("id, title, drive_date, drive_end_time")
    .eq("status", "Scheduled")
    .overrideTypes<ScheduledDrive[], { merge: false }>();

  if (drivesError) {
    console.error("CRON ERROR [complete-drives]: couldn't fetch drives:", drivesError);
    return NextResponse.json({ error: drivesError.message }, { status: 500 });
  }

  const now = new Date();
  const dueDrives = (scheduledDrives ?? []).filter(
    (d) => driveEndsAtUtc(d.drive_date, d.drive_end_time) <= now,
  );

  const summary = {
    checked: scheduledDrives?.length ?? 0,
    completed: 0,
    smsSent: 0,
    smsFailed: 0,
  };

  for (const drive of dueDrives) {
    const { error: updateError } = await supabase
      .from("drives")
      .update({ status: "Completed" })
      .eq("id", drive.id);

    if (updateError) {
      console.error(
        `CRON ERROR [complete-drives]: couldn't complete drive ${drive.id}:`,
        updateError,
      );
      continue;
    }
    summary.completed++;

    const { data: registrations } = await supabase
      .from("drive_registrations")
      .select("user:profiles(full_name, username, mobile_number)")
      .eq("drive_id", drive.id)
      .overrideTypes<RegistrationRow[], { merge: false }>();

    for (const reg of registrations ?? []) {
      if (!reg.user?.mobile_number) continue;

      const name = reg.user.full_name ?? reg.user.username;
      const message = `Hi ${name}, hope you had a great time on the drive! Don't forget to share your experience by creating a Trip Report on the web: ${SITE_URL}/trip-reports/new`;

      const result = await sendSms(reg.user.mobile_number, message);
      if (result.ok) {
        summary.smsSent++;
      } else {
        summary.smsFailed++;
      }
    }
  }

  return NextResponse.json(summary);
}
