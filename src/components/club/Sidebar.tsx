"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  BookOpen,
  CircleUser,
  LayoutDashboard,
  ShieldCheck,
  Settings,
} from "lucide-react";
import type { ComponentType } from "react";
import { Logo } from "./Logo";
import { CLUB_CONFIG } from "@/lib/constants";

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

const EQUIPMENT_REVIEW_NAV_ITEM: NavItem = {
  label: "Equipment Review",
  href: "/equipment-review",
  icon: ShieldCheck,
};

const ADMIN_NAV_ITEM: NavItem = {
  label: "Admin Settings",
  href: "/admin",
  icon: Settings,
};

// Literal class strings — Tailwind's build-time scanner can't resolve a
// template-literal `grid-cols-${n}`, so every count the item list can
// actually produce (4 base, +1 Equipment Review, +1 Admin Settings) needs
// its own entry here.
const GRID_COLS_CLASS: Record<number, string> = {
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
};

export function Sidebar({
  isAdmin = false,
  canReviewEquipment = false,
}: {
  isAdmin?: boolean;
  canReviewEquipment?: boolean;
}) {
  const pathname = usePathname();

  // Base 4 tabs for regular members, plus whichever of "Equipment Review"
  // (Marshals and Admins) and "Admin Settings" (Admins only) apply — an
  // Admin who isn't a Marshal still gets Equipment Review via the OR, same
  // isMarshal||isAdmin convention used for reviewing trip reports.
  const items = [
    ...NAV_ITEMS,
    ...(canReviewEquipment ? [EQUIPMENT_REVIEW_NAV_ITEM] : []),
    ...(isAdmin ? [ADMIN_NAV_ITEM] : []),
  ];

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

      {/* A CSS grid (rather than flex + justify-around) on mobile gives every
          tab an exactly equal-width column regardless of the item count (4,
          5, or 6 depending on Marshal/Admin status) — so a long label like
          "Official Drives" wrapping to two lines never eats into a
          neighboring tab's space. Tailwind's scanner needs complete class
          strings in source, so this can't be a template-literal
          `grid-cols-${n}` — it's a lookup instead. */}
      <ul
        className={`grid w-full items-center gap-1 ${GRID_COLS_CLASS[items.length] ?? "grid-cols-4"} lg:flex lg:flex-col lg:items-stretch`}
      >
        {items.map(({ label, href, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <li key={href} className="lg:w-full">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`
                  flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-center text-xs
                  leading-tight transition-colors
                  lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-2.5 lg:text-sm lg:font-medium
                  ${
                    isActive
                      ? "text-primary lg:bg-sand-light"
                      : "text-charcoal-light/70 hover:text-primary lg:hover:bg-sand-light"
                  }
                `}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
