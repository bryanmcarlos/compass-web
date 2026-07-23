import Link from "next/link";
import { Mountain, PenLine } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { EmptyState, ErrorState } from "@/components/club/StateMessage";
import { Tabs } from "@/components/club/Tabs";
import { Pagination } from "@/components/club/Pagination";
import { DriveThread, type ThreadReport, type ThreadDrive, type ReactionSummary } from "@/components/club/DriveThread";
import { PendingReportsReview, type PendingReport } from "@/components/club/PendingReportsReview";
import { TripReportCard } from "@/components/club/TripReportCard";
import { CommentThread, type CommentData } from "@/components/club/CommentThread";
import {
  UnlinkedReportsCleanupPanel,
  type UnlinkedReport,
  type CleanupCandidateDrive,
} from "@/components/club/UnlinkedReportsCleanupPanel";
import { dedupeByThread } from "@/lib/tripReportThreadGrouping";
import {
  CLEANUP_DATE_WINDOW_DAYS,
  extractTitleKeywords,
  countKeywordHits,
  daysBetween,
} from "@/lib/tripReportMatching";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const DRIVES_PER_PAGE = 15;
const REPORT_FIELDS =
  "id, report_text, photos, created_at, is_approved, author_id, drive_id, " +
  "author:profiles!trip_reports_author_id_fkey(username, full_name, avatar_url, current_rank), " +
  "drive:drives(title, drive_date, location)";

/** Batched, not per-report — a single drive in this data set has 58
 * reports on it, so an N+1 query per report is a real, not hypothetical,
 * cost to avoid. */
async function fetchCommentsByReport(
  supabase: SupabaseServerClient,
  reportIds: string[],
): Promise<Map<string, CommentData[]>> {
  if (reportIds.length === 0) return new Map();

  const { data } = await supabase
    .from("comments")
    .select(
      `id, comment_text, created_at, trip_report_id,
       author:profiles!comments_author_id_fkey(username, full_name, avatar_url)`,
    )
    .in("trip_report_id", reportIds)
    .order("created_at", { ascending: true })
    .overrideTypes<(CommentData & { trip_report_id: string })[], { merge: false }>();

  const map = new Map<string, CommentData[]>();
  for (const comment of data ?? []) {
    const list = map.get(comment.trip_report_id) ?? [];
    list.push(comment);
    map.set(comment.trip_report_id, list);
  }
  return map;
}

/** Same batching rationale as fetchCommentsByReport — one query for every
 * report on the page rather than one per card. `viewerId` is null for a
 * signed-out visitor, in which case every report is simply un-liked from
 * their perspective (no row could exist for a null user_id). */
async function fetchReactionsByReport(
  supabase: SupabaseServerClient,
  reportIds: string[],
  viewerId: string | null,
): Promise<Map<string, ReactionSummary>> {
  if (reportIds.length === 0) return new Map();

  const { data } = await supabase
    .from("report_reactions")
    .select("trip_report_id, user_id")
    .in("trip_report_id", reportIds)
    .overrideTypes<{ trip_report_id: string; user_id: string }[], { merge: false }>();

  const map = new Map<string, ReactionSummary>();
  for (const row of data ?? []) {
    const summary = map.get(row.trip_report_id) ?? { count: 0, liked: false };
    summary.count += 1;
    if (viewerId && row.user_id === viewerId) summary.liked = true;
    map.set(row.trip_report_id, summary);
  }
  return map;
}

type DriveThreadData = {
  drive: ThreadDrive;
  leadReport: ThreadReport | null;
  otherReports: ThreadReport[];
};

export default async function TripReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const { tab, page: pageParam } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let isMarshal = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, is_marshal")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.is_admin ?? false;
    isMarshal = profile?.is_marshal ?? false;
  }
  // Same "Marshal or Admin" derivation used everywhere else this app gates
  // moderation on — rank alone is never the check.
  const canReviewReports = isMarshal || isAdmin;

  // Cheap regardless of active tab, so the tab label is always correct —
  // same convention as the tab-count queries on /drives.
  let pendingCount = 0;
  if (canReviewReports) {
    const { count } = await supabase
      .from("trip_reports")
      .select("id", { count: "exact", head: true })
      .eq("is_approved", false);
    pendingCount = count ?? 0;
  }

  // Admin-only, temporary — candidate drives for every currently-unlinked
  // trip report, the /trip-reports counterpart to the drive-detail cleanup
  // panel. Drives are a bounded, club-lifetime dataset (unlike trip_reports,
  // which this session's migration work left at ~1800+ rows), so this
  // fetches the full list once and matches in JS rather than round-tripping
  // per report.
  let unlinkedReports: UnlinkedReport[] = [];
  if (isAdmin) {
    // What the SELECT actually returns — dedupeByThread adds `replyCount`
    // and collapses every unlinked reply back to its thread's root post, so
    // a 5-post unlinked thread shows as one card instead of 5.
    type RawUnlinkedRow = Omit<
      UnlinkedReport,
      "replyCount" | "dateCandidates" | "keywordCandidates"
    >;

    const [{ data: unlinkedRows }, { data: allDrives }] = await Promise.all([
      supabase
        .from("trip_reports")
        .select(
          "id, report_text, created_at, thread_id, author:profiles!trip_reports_author_id_fkey(username, full_name)",
        )
        .is("drive_id", null)
        .order("created_at", { ascending: false })
        .limit(200)
        .overrideTypes<RawUnlinkedRow[], { merge: false }>(),
      supabase.from("drives").select("id, title, drive_date"),
    ]);

    const dedupedUnlinked = await dedupeByThread(
      supabase,
      unlinkedRows ?? [],
      "id, report_text, created_at, thread_id, " +
        "author:profiles!trip_reports_author_id_fkey(username, full_name)",
    );

    const drivesList = allDrives ?? [];
    unlinkedReports = dedupedUnlinked.slice(0, 50).map((report) => {
      const dateCandidates: CleanupCandidateDrive[] = [];
      const keywordScored: { drive: CleanupCandidateDrive; hits: number }[] = [];

      for (const drive of drivesList) {
        if (daysBetween(report.created_at, drive.drive_date) <= CLEANUP_DATE_WINDOW_DAYS) {
          dateCandidates.push(drive);
        }
        const keywords = extractTitleKeywords(drive.title);
        const hits = keywords.length > 0 ? countKeywordHits(keywords, report.report_text) : 0;
        if (hits > 0) keywordScored.push({ drive, hits });
      }

      const keywordCandidates = keywordScored
        .sort((a, b) => b.hits - a.hits)
        .slice(0, 10)
        .map((entry) => entry.drive);

      return { ...report, dateCandidates: dateCandidates.slice(0, 15), keywordCandidates };
    });
  }

  const tabs = [
    { key: "all", label: "All Reports" },
    ...(canReviewReports
      ? [{ key: "pending", label: `Pending Review (${pendingCount})` }]
      : []),
  ];
  // A non-marshal hitting ?tab=pending directly is silently treated as
  // "all" — the pendingReports query below is gated on canReviewReports
  // regardless, so this is a UI nicety, not the real access control.
  const activeTab = tab === "pending" && canReviewReports ? "pending" : "all";

  let error: string | null = null;
  let threads: DriveThreadData[] = [];
  let generalReports: ThreadReport[] = [];
  let commentsByReport = new Map<string, CommentData[]>();
  let reactionsByReport = new Map<string, ReactionSummary>();
  let page = 1;
  let totalPages = 1;
  let pendingReports: PendingReport[] = [];

  if (activeTab === "pending") {
    const { data, error: fetchError } = await supabase
      .from("trip_reports")
      .select(
        `id, report_text,
         author:profiles!trip_reports_author_id_fkey(username, full_name, avatar_url),
         drive:drives(id, title)`,
      )
      .eq("is_approved", false)
      .order("created_at", { ascending: false })
      .overrideTypes<PendingReport[], { merge: false }>();
    if (fetchError) error = fetchError.message;
    pendingReports = data ?? [];
  } else {
    // Step 1: thin rows to establish per-drive recency ordering + the
    // pagination window — grouping-by-drive has no RPC/migration precedent
    // in this codebase, so this follows the same "plain select + JS
    // post-processing" convention as driverCountsByDrive on /drives.
    const { data: thinRows, error: thinError } = await supabase
      .from("trip_reports")
      .select("drive_id, created_at")
      .eq("is_approved", true)
      .not("drive_id", "is", null)
      .overrideTypes<{ drive_id: string; created_at: string }[], { merge: false }>();

    if (thinError) {
      error = thinError.message;
    } else {
      const maxCreatedAtByDrive = new Map<string, string>();
      for (const row of thinRows ?? []) {
        const current = maxCreatedAtByDrive.get(row.drive_id);
        if (!current || row.created_at > current) {
          maxCreatedAtByDrive.set(row.drive_id, row.created_at);
        }
      }
      const orderedDriveIds = Array.from(maxCreatedAtByDrive.entries())
        .sort((a, b) => (a[1] < b[1] ? 1 : -1))
        .map(([driveId]) => driveId);

      totalPages = Math.max(Math.ceil(orderedDriveIds.length / DRIVES_PER_PAGE), 1);
      const requestedPage = Number(pageParam);
      page = Number.isInteger(requestedPage)
        ? Math.min(Math.max(requestedPage, 1), totalPages)
        : 1;

      const pageDriveIds = orderedDriveIds.slice(
        (page - 1) * DRIVES_PER_PAGE,
        page * DRIVES_PER_PAGE,
      );

      const allReportIds: string[] = [];

      if (pageDriveIds.length > 0) {
        const [{ data: reportRows, error: reportsError }, { data: leadRows }] = await Promise.all([
          supabase
            .from("trip_reports")
            .select(REPORT_FIELDS)
            .eq("is_approved", true)
            .in("drive_id", pageDriveIds)
            .order("created_at", { ascending: true })
            .overrideTypes<ThreadReport[], { merge: false }>(),
          supabase
            .from("drive_registrations")
            .select("drive_id, user_id")
            .eq("role", "Lead")
            .in("drive_id", pageDriveIds),
        ]);

        if (reportsError) error = reportsError.message;

        const leadUserIdsByDrive = new Map<string, Set<string>>();
        for (const row of leadRows ?? []) {
          const set = leadUserIdsByDrive.get(row.drive_id) ?? new Set<string>();
          set.add(row.user_id);
          leadUserIdsByDrive.set(row.drive_id, set);
        }

        const reportsByDrive = new Map<string, ThreadReport[]>();
        for (const report of reportRows ?? []) {
          allReportIds.push(report.id);
          const list = reportsByDrive.get(report.drive_id) ?? [];
          list.push(report);
          reportsByDrive.set(report.drive_id, list);
        }

        threads = pageDriveIds
          .map((driveId): DriveThreadData | null => {
            const reports = reportsByDrive.get(driveId);
            if (!reports || reports.length === 0 || !reports[0].drive) return null;

            const leadUserIds = leadUserIdsByDrive.get(driveId);
            const leadIndex = leadUserIds
              ? reports.findIndex((r) => leadUserIds.has(r.author_id))
              : -1;
            const leadReport = leadIndex >= 0 ? reports[leadIndex] : null;
            const otherReports = leadIndex >= 0
              ? reports.filter((_, i) => i !== leadIndex)
              : reports;

            return {
              drive: { id: driveId, ...reports[0].drive! },
              leadReport,
              otherReports,
            };
          })
          .filter((t): t is DriveThreadData => t !== null);
      }

      // Standalone reports (no drive_id) — none exist today, but the
      // column is nullable and submitTripReport allows it, so this bucket
      // stays real rather than assumed-permanently-empty. Shown on page 1
      // only, not repeated on every page.
      if (page === 1) {
        const { data: generalRows } = await supabase
          .from("trip_reports")
          .select(REPORT_FIELDS)
          .eq("is_approved", true)
          .is("drive_id", null)
          .order("created_at", { ascending: false })
          .overrideTypes<ThreadReport[], { merge: false }>();
        generalReports = generalRows ?? [];
        allReportIds.push(...generalReports.map((r) => r.id));
      }

      [commentsByReport, reactionsByReport] = await Promise.all([
        fetchCommentsByReport(supabase, allReportIds),
        fetchReactionsByReport(supabase, allReportIds, user?.id ?? null),
      ]);
    }
  }

  const isEmpty =
    activeTab === "pending"
      ? pendingReports.length === 0
      : threads.length === 0 && generalReports.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-forest">
              <Mountain className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-charcoal">
              Trip Reports
            </h1>
          </div>
          <p className="text-sm text-charcoal-light/80">
            Approved recaps from the community — the club&apos;s learning
            journal.
          </p>
        </div>
        <Link
          href="/trip-reports/new"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-off-white transition-colors hover:brightness-90"
        >
          <PenLine className="h-4 w-4" />
          Share a Trip Report
        </Link>
      </header>

      {isAdmin && (
        <div className="mx-auto w-full max-w-2xl">
          <UnlinkedReportsCleanupPanel reports={unlinkedReports} />
        </div>
      )}

      {tabs.length > 1 && <Tabs tabs={tabs} defaultKey="all" />}

      {error ? (
        <ErrorState message="Couldn't load trip reports right now. Please try again shortly." />
      ) : isEmpty ? (
        <EmptyState
          icon={Mountain}
          title={activeTab === "pending" ? "Nothing pending" : "No trip reports yet"}
          message={
            activeTab === "pending"
              ? "Every submitted report has already been reviewed."
              : "Approved recaps from official drives will show up here once members share them."
          }
        />
      ) : activeTab === "pending" ? (
        <PendingReportsReview reports={pendingReports} canDelete={isAdmin} />
      ) : (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
          {threads.map((thread) => (
            <DriveThread
              key={thread.drive.id}
              drive={thread.drive}
              leadReport={thread.leadReport}
              otherReports={thread.otherReports}
              commentsByReport={commentsByReport}
              reactionsByReport={reactionsByReport}
              canDelete={isAdmin}
            />
          ))}

          {generalReports.length > 0 && (
            <section className="flex flex-col gap-4 rounded-2xl border border-sand bg-off-white p-5 shadow-sm sm:p-6">
              <h2 className="text-sm font-semibold text-charcoal">General Reports</h2>
              {generalReports.map((report, index) => (
                <div
                  key={report.id}
                  className={`flex flex-col gap-2 ${index === 0 ? "" : "border-t border-sand pt-4"}`}
                >
                  <TripReportCard
                    report={report}
                    linkToDetail
                    showDriveContext={false}
                    canDelete={isAdmin}
                    likeCount={reactionsByReport.get(report.id)?.count ?? 0}
                    viewerLiked={reactionsByReport.get(report.id)?.liked ?? false}
                  />
                  <CommentThread reportId={report.id} comments={commentsByReport.get(report.id) ?? []} />
                </div>
              ))}
            </section>
          )}

          <Pagination
            page={page}
            totalPages={totalPages}
            buildHref={(p) => (p === 1 ? "/trip-reports" : `/trip-reports?page=${p}`)}
          />
        </div>
      )}
    </div>
  );
}
