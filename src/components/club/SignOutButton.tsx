"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, LoaderCircle, CircleAlert } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setIsSigningOut(true);
    setError(null);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch (err) {
      // A dropped network request here shouldn't leave an uncaught rejection
      // — surface it and let the member try again from a live button.
      console.error("Sign out failed:", err);
      setError("Couldn't sign out — check your connection and try again.");
      setIsSigningOut(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-sand bg-off-white px-4 py-2.5 text-sm font-semibold text-charcoal-light transition-colors hover:border-error/40 hover:bg-error-bg hover:text-error disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSigningOut ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <LogOut className="h-4 w-4" />
        )}
        {isSigningOut ? "Signing out…" : "Sign Out"}
      </button>
      {error && (
        <p
          role="alert"
          className="flex items-center justify-center gap-1.5 text-xs text-error"
        >
          <CircleAlert className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
