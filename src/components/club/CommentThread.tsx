"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, LoaderCircle, CircleAlert, Send } from "lucide-react";
import { submitComment, type SubmitCommentState } from "@/app/(app)/trip-reports/actions";
import { Avatar } from "./Avatar";
import { formatRelativeTime } from "@/lib/format";

export type CommentData = {
  id: string;
  comment_text: string;
  created_at: string;
  author: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

const initialState: SubmitCommentState = { status: "idle", message: null };

/** Flat comment list + an always-rendered add-comment form below it — the
 * Server Action re-verifies auth itself and rejects a signed-out submit,
 * matching this codebase's existing pattern (e.g. the "Share a Trip Report"
 * CTA) of not adding a redundant client-side auth gate on top of that. */
export function CommentThread({ reportId, comments }: { reportId: string; comments: CommentData[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(submitComment, initialState);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <div className="flex flex-col gap-3 border-t border-sand pt-3">
      {comments.length > 0 && (
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => {
            const name = comment.author?.full_name ?? comment.author?.username ?? "A club member";
            return (
              <li key={comment.id} className="flex items-start gap-2.5">
                <Avatar
                  name={name}
                  avatarUrl={comment.author?.avatar_url ?? null}
                  className="h-7 w-7 shrink-0 text-[10px]"
                />
                <div className="min-w-0 flex-1 rounded-lg bg-sand-light px-3 py-2">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-xs font-semibold text-charcoal">{name}</span>
                    <span className="text-[11px] text-charcoal-light/60">
                      {formatRelativeTime(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-sm break-words text-charcoal-light/90">
                    {comment.comment_text}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form ref={formRef} action={formAction} className="flex items-start gap-2">
        <MessageCircle className="mt-2.5 h-4 w-4 shrink-0 text-charcoal-light/40" />
        <input type="hidden" name="reportId" value={reportId} />
        <textarea
          name="commentText"
          rows={1}
          maxLength={2000}
          placeholder="Add a comment…"
          required
          className="min-w-0 flex-1 resize-y rounded-lg border border-sand bg-off-white px-3 py-2 text-sm text-charcoal placeholder:text-charcoal-light/40 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
        />
        <button
          type="submit"
          disabled={isPending}
          aria-label="Post comment"
          title="Post comment"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-off-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>
      {state.status === "error" && (
        <p className="flex items-center gap-1.5 text-xs text-error">
          <CircleAlert className="h-3.5 w-3.5 shrink-0" />
          {state.message}
        </p>
      )}
    </div>
  );
}
