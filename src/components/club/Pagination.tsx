import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Plain Link-based pager — the caller is always a Server Component that
 * already has `searchParams`, so no client hook is needed here (unlike
 * Tabs.tsx, which needs usePathname/useSearchParams to compute its own
 * active state client-side). */
export function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  /** Given a target page number, returns the full href (including
   * preserving any other query params the caller cares about, e.g. `tab`). */
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center justify-center gap-3 pt-2" aria-label="Pagination">
      {page > 1 ? (
        <Link
          href={buildHref(page - 1)}
          className="flex items-center gap-1 rounded-lg border border-sand bg-off-white px-3 py-1.5 text-sm font-medium text-charcoal-light hover:border-forest/40 hover:text-forest"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Link>
      ) : (
        <span className="flex items-center gap-1 rounded-lg border border-sand px-3 py-1.5 text-sm font-medium text-charcoal-light/40">
          <ChevronLeft className="h-4 w-4" />
          Prev
        </span>
      )}
      <span className="text-sm text-charcoal-light/70">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link
          href={buildHref(page + 1)}
          className="flex items-center gap-1 rounded-lg border border-sand bg-off-white px-3 py-1.5 text-sm font-medium text-charcoal-light hover:border-forest/40 hover:text-forest"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className="flex items-center gap-1 rounded-lg border border-sand px-3 py-1.5 text-sm font-medium text-charcoal-light/40">
          Next
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}
