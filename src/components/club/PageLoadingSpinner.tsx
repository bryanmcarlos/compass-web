import { LoaderCircle } from "lucide-react";

/** Used as the body of route-level loading.tsx files — the fallback Next
 * shows immediately on navigation while the destination page's data
 * fetches. */
export function PageLoadingSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <LoaderCircle className="h-8 w-8 animate-spin text-forest" />
    </div>
  );
}
