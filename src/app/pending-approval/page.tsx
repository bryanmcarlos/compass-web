import { Hourglass } from "lucide-react";
import { SignOutButton } from "@/components/club/SignOutButton";

/** Reachable only via the redirect in (app)/layout.tsx for a signed-in but
 * not-yet-approved profile — kept as a top-level route outside the (app)
 * route group (same reason /login lives there too) so it never triggers
 * that same layout's redirect and loops. */
export default function PendingApprovalPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-light px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-sand bg-off-white p-8 text-center shadow-lg">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-forest/10 text-forest">
          <Hourglass className="h-6 w-6" />
        </span>
        <h1 className="text-xl font-bold tracking-tight text-charcoal">
          Pending Approval
        </h1>
        <p className="text-sm text-charcoal-light/80">
          Your COMPASS account is pending Marshal verification.
        </p>
        <p className="text-xs text-charcoal-light/60">
          A Marshal will review your account shortly. Once approved, you&apos;ll
          be able to sign in and register for drives.
        </p>
        <div className="w-full pt-2">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
