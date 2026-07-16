"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Compass,
  BookOpen,
  CircleUser,
  LayoutDashboard,
  LogOut,
  LoaderCircle,
} from "lucide-react";
import type { ComponentType } from "react";
import { Logo } from "./Logo";
import { CLUB_CONFIG } from "@/lib/constants";
import { createClient } from "@/utils/supabase/client";

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Official Drives", href: "/drives", icon: Compass },
  { label: "Trip Reports", href: "/trip-reports", icon: BookOpen },
  { label: "Profile", href: "/profile", icon: CircleUser },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch (error) {
      // A dropped network request here shouldn't leave an uncaught
      // rejection — log it and let the marshal try again from a live button.
      console.error("Sign out failed:", error);
      setIsSigningOut(false);
    }
  }

  return (
    <nav
      className="
        fixed bottom-0 left-0 z-40 flex min-h-16 w-full items-center
        justify-around border-t border-sand bg-off-white pb-[env(safe-area-inset-bottom)]
        lg:inset-y-0 lg:bottom-auto lg:h-screen lg:w-64 lg:flex-col
        lg:items-stretch lg:justify-start lg:border-t-0 lg:border-r lg:px-4 lg:py-6 lg:pb-6
      "
    >
      <div className="hidden px-2 pb-8 lg:flex">
        <Link href="/" aria-label={`${CLUB_CONFIG.metadata.shortName} home`}>
          <Logo className="h-9 w-auto" />
        </Link>
      </div>

      <ul className="flex w-full items-center justify-around lg:flex-col lg:items-stretch lg:gap-1">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <li key={href} className="lg:w-full">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`
                  flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs
                  transition-colors
                  lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-2.5 lg:text-sm lg:font-medium
                  ${
                    isActive
                      ? "text-forest lg:bg-sand-light"
                      : "text-charcoal-light/70 hover:text-forest lg:hover:bg-sand-light"
                  }
                `}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}

        <li className="lg:mt-auto lg:w-full lg:border-t lg:border-sand lg:pt-3">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="
              flex w-full flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs
              text-charcoal-light/70 transition-colors
              hover:text-error disabled:cursor-not-allowed disabled:opacity-60
              lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-2.5 lg:text-sm lg:font-medium
              lg:hover:bg-error-bg
            "
          >
            {isSigningOut ? (
              <LoaderCircle className="h-5 w-5 shrink-0 animate-spin" />
            ) : (
              <LogOut className="h-5 w-5 shrink-0" />
            )}
            <span>{isSigningOut ? "Signing out…" : "Sign Out"}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
