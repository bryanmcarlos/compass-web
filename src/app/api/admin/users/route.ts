import { type NextRequest, NextResponse } from "next/server";
import { createClient as createServiceRoleClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

type ResetPasswordPayload = { userId: string; action: "resetPassword"; data: { newPassword: string } };
type RequestPayload = ResetPasswordPayload | { userId: string; action: string; data?: unknown };

/**
 * The one admin operation in this app that genuinely cannot be done with the
 * normal session-scoped client + RLS — setting a member's password directly
 * (no old password, no email round-trip) only exists on Supabase Auth's
 * admin API (`auth.admin.updateUserById`), which requires the service-role
 * key. Rank changes, account disable, and profile-field edits are handled
 * elsewhere as ordinary Server Actions against `profiles`, since none of
 * those need to bypass RLS — keep this route's blast radius to just the one
 * thing that actually requires it.
 */
export async function PATCH(request: NextRequest) {
  // Re-derive admin status from the caller's own session cookie — the
  // request body's userId/action are never trusted as a substitute for this.
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "You need to be signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json(
      { error: "Only Super Admins can manage member accounts." },
      { status: 403 },
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error("API ERROR [/api/admin/users]: SUPABASE_SERVICE_ROLE_KEY is not set.");
    return NextResponse.json(
      {
        error:
          "This server isn't configured for account-management actions yet — SUPABASE_SERVICE_ROLE_KEY is missing.",
      },
      { status: 500 },
    );
  }

  let body: RequestPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { userId, action } = body;
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "Missing userId." }, { status: 400 });
  }

  if (action !== "resetPassword") {
    return NextResponse.json({ error: `Unknown action: ${String(action)}` }, { status: 400 });
  }

  const newPassword = (body as ResetPasswordPayload).data?.newPassword;
  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters." },
      { status: 400 },
    );
  }

  // Deliberately a one-off client scoped to this request, never persisted or
  // reused across requests, and never exposed to the browser — this key
  // bypasses RLS entirely.
  const adminClient = createServiceRoleClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) {
    console.error("API ERROR [/api/admin/users resetPassword]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "success", message: "Password reset." });
}
