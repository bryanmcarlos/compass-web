"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";

export type ToggleReactionState = { status: "idle" | "error" | "success"; liked: boolean; message?: string | null };

/** Optimistic like/unlike toggle, reused across Drives, Trip Reports, and
 * Announcements — the interaction and appearance are identical everywhere,
 * only which table `toggleAction` writes to differs, so this is one shared
 * component rather than three near-duplicates. Flips immediately on click
 * and reconciles with whatever the server actually persisted, rather than
 * waiting on the round-trip before showing anything. */
export function LikeButton({
  initialLiked,
  initialCount,
  toggleAction,
}: {
  initialLiked: boolean;
  initialCount: number;
  toggleAction: () => Promise<ToggleReactionState>;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    // Several call sites render this inside a card that's itself a <Link>
    // (the trip-report feed, drive cards) — liking shouldn't also navigate.
    e.preventDefault();
    e.stopPropagation();

    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((c) => c + (nextLiked ? 1 : -1));

    startTransition(async () => {
      const result = await toggleAction();
      if (result.status === "error") {
        // Roll back — the optimistic flip didn't actually persist.
        setLiked(!nextLiked);
        setCount((c) => c + (nextLiked ? -1 : 1));
        return;
      }
      // Trust the server's own liked flag over our own guess, in case of a
      // race (e.g. a duplicate click landing between click and response).
      setLiked(result.liked);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={liked}
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
        liked
          ? "bg-error-bg text-error"
          : "bg-sand-light text-charcoal-light/70 hover:text-error"
      }`}
    >
      <Heart className={`h-3.5 w-3.5 ${liked ? "fill-error" : ""}`} />
      {count}
    </button>
  );
}
