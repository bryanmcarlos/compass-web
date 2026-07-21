"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** URL-search-param-driven tab nav — the active tab lives in `?tab=`, not
 * client state, matching how drives/[id] already reads `searchParams` for
 * its `reportSubmitted` banner (one pattern per page, not two). Bookmarkable
 * and shareable as a side effect. Preserves every other existing query
 * param when switching tabs rather than clobbering the URL. */
export function Tabs({
  tabs,
  paramName = "tab",
  defaultKey,
}: {
  tabs: { key: string; label: string }[];
  paramName?: string;
  defaultKey: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeKey = searchParams.get(paramName) ?? defaultKey;

  function hrefFor(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === defaultKey) {
      params.delete(paramName);
    } else {
      params.set(paramName, key);
    }
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  return (
    <div
      role="tablist"
      className="flex w-full flex-nowrap gap-1 overflow-x-auto whitespace-nowrap rounded-xl border border-sand bg-sand-light/50 p-1 scrollbar-none"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <Link
            key={tab.key}
            href={hrefFor(tab.key)}
            role="tab"
            aria-selected={isActive}
            scroll={false}
            className={`flex-1 shrink-0 rounded-lg px-3 py-2 text-center text-sm font-semibold whitespace-nowrap transition-colors ${
              isActive
                ? "bg-off-white text-forest shadow-sm"
                : "text-charcoal-light/70 hover:text-charcoal"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
