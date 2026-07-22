"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** A React-controlled `<details>` — `open` is driven by state initialized
 * fresh on every mount, not a static attribute. A plain `<details open>`
 * looks equivalent at first glance, but it isn't: once a user has manually
 * toggled it via the native disclosure triangle, the browser's own DOM
 * property can drift out of sync with React's unchanged JSX value on a
 * later re-render (React only re-applies an attribute when the value it's
 * given actually changes between renders) — so it can end up stuck closed
 * on a subsequent render of the same mounted instance. Owning `open` as
 * state via `onToggle` closes that gap: every state change goes through
 * React, so there's nothing for the DOM to drift from. */
export function CollapsibleSection({
  title,
  icon,
  defaultOpen = true,
  children,
  className = "",
}: {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className={`group rounded-2xl border border-sand bg-off-white p-5 shadow-sm sm:p-6 ${className}`}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-charcoal marker:content-none">
        {icon}
        {title}
        <ChevronDown className="ml-auto h-4 w-4 text-charcoal-light/50 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
