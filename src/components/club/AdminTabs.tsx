"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Palette, Users } from "lucide-react";
import type { ComponentType } from "react";

const TABS: { label: string; href: string; icon: ComponentType<{ className?: string }> }[] = [
  { label: "Site Settings", href: "/admin/site-settings", icon: Palette },
  { label: "Members", href: "/admin/members", icon: Users },
];

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 border-b border-sand">
      {TABS.map(({ label, href, icon: Icon }) => {
        const isActive = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-charcoal-light/70 hover:text-charcoal"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
