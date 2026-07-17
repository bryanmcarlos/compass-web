import { type NextRequest, NextResponse } from "next/server";
import { createClient as createServiceRoleClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

type ResetPasswordPayload = { userId: string; action: "resetPassword"; data: { newPassword: string } };
type RequestPayload = ResetPasswordPayload | { userId: string; action: string; data?: unknown };

type AdminCheckResult =
  | { ok: true; adminClient: SupabaseClient }
  | { ok: false; response: NextResponse };

/**
 * Shared by every handler below: re-derives admin status from the caller's
 * own session cookie (never trusts a client-supplied flag), then mints a
 * one-off service-role client scoped to this single request — never
 * persisted, never exposed to the browser. This key bypasses RLS entirely,
 * so it's deliberately the only place in the app that touches it, and only
 * for the operations that genuinely have no RLS-respecting equivalent:
 * setting a password directly, and reading a member's login email (which
 * lives in Supabase's `auth.users`, never exposed to the normal client).
 */
async function requireAdminServiceClient(): Promise<AdminCheckResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "You need to be signed in." }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Only Super Admins can manage member accounts." },
        { status: 403 },
      ),
    };
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error("API ERROR [/api/admin/users]: SUPABASE_SERVICE_ROLE_KEY is not set.");
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "This server isn't configured for account-management actions yet — SUPABASE_SERVICE_ROLE_KEY is missing.",
        },
        { status: 500 },
      ),
    };
  }

  const adminClient = createServiceRoleClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return { ok: true, adminClient };
}

/** Fetches a single member's login email — `?userId=`. Rank/disable/profile-
 * field reads and writes all go through `profiles` via ordinary Server
 * Actions instead; this route is only for the two things that need
 * Supabase's Admin API. */
export async function GET(request: NextRequest) {
  const check = await requireAdminServiceClient();
  if (!check.ok) {
    return check.response;
  }

  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Missing userId." }, { status: 400 });
  }

  const { data, error } = await check.adminClient.auth.admin.getUserById(userId);
  if (error || !data.user) {
    console.error("API ERROR [/api/admin/users GET]:", error);
    return NextResponse.json({ error: error?.message ?? "User not found." }, { status: 404 });
  }

  return NextResponse.json({ email: data.user.email ?? null });
}

export async function PATCH(request: NextRequest) {
  const check = await requireAdminServiceClient();
  if (!check.ok) {
    return check.response;
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

  const { error } = await check.adminClient.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) {
    console.error("API ERROR [/api/admin/users PATCH resetPassword]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "success", message: "Password reset." });
}
