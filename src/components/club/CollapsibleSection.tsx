"use client";

import { useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

const DRAG_THRESHOLD_PX = 10;

/** A React-controlled `<details>` — `open` is driven by state initialized
 * fresh on every mount, not a static attribute, so there's nothing for a
 * later render to drift from (see the `onToggle` handler below).
 *
 * Separately, and this is the one that actually caused reports of the
 * section "closing itself": the native `<summary>` is one large, full-width
 * tap target, and it sits directly above other content in the scroll flow.
 * A screen-recording review caught the real mechanism — a scroll gesture
 * that happens to start on top of the summary bar gets interpreted by the
 * browser as a tap-to-toggle, closing it mid-scroll with no deliberate tap
 * involved. Pointer tracking below distinguishes a genuine tap from a
 * scroll/drag (same pattern as SwipeToDeleteRow's swipe-vs-tap check) and
 * cancels the native toggle when real movement was involved. */
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
  const startYRef = useRef<number | null>(null);
  const draggedRef = useRef(false);

  function handlePointerDown(e: PointerEvent) {
    startYRef.current = e.clientY;
    draggedRef.current = false;
  }

  function handlePointerMove(e: PointerEvent) {
    if (startYRef.current === null) return;
    if (Math.abs(e.clientY - startYRef.current) > DRAG_THRESHOLD_PX) {
      draggedRef.current = true;
    }
  }

  // The summary's own click is what the browser uses to decide whether to
  // toggle — canceling it here (only when real movement preceded it) stops
  // the native toggle without touching `open`/`onToggle` at all.
  function handleSummaryClick(e: MouseEvent) {
    if (draggedRef.current) {
      e.preventDefault();
    }
    startYRef.current = null;
    draggedRef.current = false;
  }

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className={`group rounded-2xl border border-sand bg-off-white p-5 shadow-sm sm:p-6 ${className}`}
    >
      <summary
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onClick={handleSummaryClick}
        className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-charcoal marker:content-none"
      >
        {icon}
        {title}
        <ChevronDown className="ml-auto h-4 w-4 text-charcoal-light/50 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
