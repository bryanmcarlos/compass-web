"use client";

import { useRef, useState, useTransition, type PointerEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2 } from "lucide-react";
import { deleteDrive } from "@/app/(app)/drives/actions";

const REVEAL_WIDTH = 88;
const DRAG_CLICK_THRESHOLD = 8;

/** Swipe-left-to-reveal-delete, Admin only — wraps a drive card (itself
 * often a `<Link>`) without touching its own markup. Plain Pointer Events,
 * no gesture library. A drag past DRAG_CLICK_THRESHOLD suppresses the
 * following click so a swipe never also triggers the card's own navigation.
 * Non-admins get `children` back completely untouched — no hidden button,
 * no swipe listeners at all, not just a disabled one. */
export function SwipeToDeleteRow({
  driveId,
  driveTitle,
  enabled,
  children,
}: {
  driveId: string;
  driveTitle: string;
  enabled: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startXRef = useRef<number | null>(null);
  const draggedRef = useRef(false);

  if (!enabled) return <>{children}</>;

  function handlePointerDown(e: PointerEvent) {
    startXRef.current = e.clientX;
    draggedRef.current = false;
  }

  function handlePointerMove(e: PointerEvent) {
    if (startXRef.current === null) return;
    const delta = e.clientX - startXRef.current;
    if (Math.abs(delta) > DRAG_CLICK_THRESHOLD) draggedRef.current = true;
    setOffset(Math.min(0, Math.max(-REVEAL_WIDTH, delta)));
  }

  function endDrag() {
    startXRef.current = null;
    setOffset((prev) => (prev <= -REVEAL_WIDTH / 2 ? -REVEAL_WIDTH : 0));
  }

  // Capture-phase so this runs before the wrapped card's own onClick/Link
  // navigation — a swipe should never also count as a tap on the card.
  function handleClickCapture(e: React.MouseEvent) {
    if (draggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      draggedRef.current = false;
    }
  }

  function handleDelete() {
    const confirmed = window.confirm(`Delete "${driveTitle}"? This can't be undone.`);
    if (!confirmed) {
      setOffset(0);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteDrive(driveId);
      if (result.status === "error") {
        setError(result.message);
        setOffset(0);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        aria-label={`Delete ${driveTitle}`}
        style={{ width: REVEAL_WIDTH }}
        className="absolute inset-y-0 right-0 flex items-center justify-center gap-1.5 bg-error text-xs font-semibold text-off-white disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        {!isPending && "Delete"}
      </button>

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={handleClickCapture}
        style={{ transform: `translateX(${offset}px)`, touchAction: "pan-y" }}
        className="relative bg-off-white transition-transform duration-150 ease-out"
      >
        {children}
      </div>

      {error && <p className="px-1 pt-1 text-xs text-error">{error}</p>}
    </div>
  );
}
