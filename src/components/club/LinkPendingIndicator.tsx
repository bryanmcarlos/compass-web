"use client";

import { useLinkStatus } from "next/link";
import { LoaderCircle } from "lucide-react";

/** Renders inside a `next/link` `<Link>` as a "this was tapped, hang on"
 * cue. Invisible until the navigation has been pending for 120ms (see the
 * .link-pending-spinner rule in globals.css), so fast/prefetched
 * navigations never show a flash. Must be a descendant of a Link. Caller
 * supplies sizing/color via className since Tailwind classes here would
 * otherwise conflict with the caller's on specificity ties. */
export function LinkPendingIndicator({ className }: { className: string }) {
  const { pending } = useLinkStatus();
  return (
    <LoaderCircle
      aria-hidden="true"
      data-pending={pending}
      className={`link-pending-spinner pointer-events-none shrink-0 animate-spin ${className}`}
    />
  );
}
