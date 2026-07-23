import type { createClient } from "@/utils/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type ThreadDeduped<T> = T & {
  /** Total other posts sharing this row's thread — 0 for an organic
   * (thread_id null) report, since it has no thread to speak of. */
  replyCount: number;
};

type ThreadAwareRow = { id: string; thread_id: string | null };

/** Collapses a list of candidate trip_reports rows down to one row per
 * thread_id — that thread's root/post_order=1 post — plus how many other
 * posts that thread has. Without this, a reply that happens to match a
 * date window or keyword search shows up as its own separate candidate
 * instead of surfacing as part of its thread, and linking it would only
 * move that one reply rather than the whole conversation. Organic rows
 * (thread_id null, submitted through the live app) pass through
 * unchanged, one row each — they have no thread to collapse into. */
export async function dedupeByThread<T extends ThreadAwareRow>(
  supabase: SupabaseServerClient,
  rows: T[],
  selectStr: string,
): Promise<ThreadDeduped<T>[]> {
  const threadIds = Array.from(
    new Set(rows.map((r) => r.thread_id).filter((t): t is string => t !== null)),
  );
  const organicRows: ThreadDeduped<T>[] = rows
    .filter((r) => r.thread_id === null)
    .map((r) => ({ ...r, replyCount: 0 }));

  if (threadIds.length === 0) return organicRows;

  const [{ data: rootRows }, { data: allThreadRows }] = await Promise.all([
    supabase
      .from("trip_reports")
      .select(selectStr)
      .in("thread_id", threadIds)
      .eq("post_order", 1)
      .overrideTypes<T[], { merge: false }>(),
    supabase.from("trip_reports").select("thread_id").in("thread_id", threadIds),
  ]);

  const countByThread = new Map<string, number>();
  for (const row of (allThreadRows ?? []) as { thread_id: string }[]) {
    countByThread.set(row.thread_id, (countByThread.get(row.thread_id) ?? 0) + 1);
  }

  const threadedRows: ThreadDeduped<T>[] = (rootRows ?? []).map((r) => ({
    ...r,
    replyCount: Math.max((countByThread.get(r.thread_id as string) ?? 1) - 1, 0),
  }));

  return [...threadedRows, ...organicRows];
}
