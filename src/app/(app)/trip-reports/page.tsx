import Link from "next/link";
import { Mountain, MapPin, BadgeCheck, Route, PenLine } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { EmptyState, ErrorState } from "@/components/club/StateMessage";
import { Avatar } from "@/components/club/Avatar";
import { RankBadge } from "@/components/club/RankBadge";
import { formatDate } from "@/lib/format";

type TripReportAuthor = {
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  current_rank: number;
};

type TripReportDrive = {
  title: string;
  drive_date: string;
  location: string;
};

type TripReport = {
  id: string;
  report_text: string;
  photos: string[] | null;
  created_at: string;
  author: TripReportAuthor | null;
  drive: TripReportDrive | null;
};

function formatRelativeTime(iso: string) {
  const diffMinutes = Math.round(
    (new Date(iso).getTime() - Date.now()) / 60_000,
  );
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const divisions: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 24 * 365],
    ["month", 60 * 24 * 30],
    ["week", 60 * 24 * 7],
    ["day", 60 * 24],
    ["hour", 60],
    ["minute", 1],
  ];

  for (const [unit, minutesInUnit] of divisions) {
    if (unit === "minute" || Math.abs(diffMinutes) >= minutesInUnit) {
      return rtf.format(Math.round(diffMinutes / minutesInUnit), unit);
    }
  }
  return rtf.format(diffMinutes, "minute");
}

function PhotoGallery({
  photos,
  reportAuthor,
}: {
  photos: string[];
  reportAuthor: string;
}) {
  const visible = photos.slice(0, 4);
  const extra = photos.length - visible.length;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {visible.map((url, i) => (
        <div
          key={url}
          className="relative aspect-square overflow-hidden rounded-lg border border-sand bg-sand-light"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary member-hosted URLs (Cloudinary/Imgur), no known remote domain to allowlist */}
          <img
            src={url}
            alt={`Photo ${i + 1} from ${reportAuthor}'s trip report`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
          {i === visible.length - 1 && extra > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-charcoal/60 text-sm font-semibold text-off-white">
              +{extra}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TripReportCard({ report }: { report: TripReport }) {
  const authorName =
    report.author?.full_name ?? report.author?.username ?? "A club member";

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-sand bg-off-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <Avatar
          name={authorName}
          avatarUrl={report.author?.avatar_url ?? null}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-semibold text-charcoal">{authorName}</span>
            {report.author && <RankBadge rank={report.author.current_rank} />}
          </div>
          <span className="text-xs text-charcoal-light/70">
            {formatRelativeTime(report.created_at)}
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-forest/10 px-2 py-1 text-[11px] font-semibold text-forest">
          <BadgeCheck className="h-3.5 w-3.5" />
          Approved
        </span>
      </div>

      {report.drive && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-sand-light px-3 py-2 text-xs font-medium text-charcoal-light/90">
          <span className="flex items-center gap-1.5">
            <Route className="h-3.5 w-3.5 text-forest" />
            {report.drive.title}
          </span>
          <span aria-hidden="true">·</span>
          <span>{formatDate(report.drive.drive_date)}</span>
          <span aria-hidden="true">·</span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {report.drive.location}
          </span>
        </div>
      )}

      <p className="whitespace-pre-wrap text-sm leading-relaxed text-charcoal">
        {report.report_text}
      </p>

      {report.photos && report.photos.length > 0 && (
        <PhotoGallery photos={report.photos} reportAuthor={authorName} />
      )}
    </article>
  );
}

export default async function TripReportsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_reports")
    .select(
      `id, report_text, photos, created_at,
       author:profiles!trip_reports_author_id_fkey(username, full_name, avatar_url, current_rank),
       drive:drives(title, drive_date, location)`,
    )
    .eq("is_approved", true)
    .order("created_at", { ascending: false })
    .limit(50)
    .overrideTypes<TripReport[], { merge: false }>();

  const reports = data ?? [];

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
          className="flex items-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-off-white transition-colors hover:bg-forest-dark"
        >
          <PenLine className="h-4 w-4" />
          Share a Trip Report
        </Link>
      </header>

      {error ? (
        <ErrorState message="Couldn't load trip reports right now. Please try again shortly." />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={Mountain}
          title="No trip reports yet"
          message="Approved recaps from official drives will show up here once members share them."
        />
      ) : (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
          {reports.map((report) => (
            <TripReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
