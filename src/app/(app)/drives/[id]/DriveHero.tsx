import { Calendar, Clock, MapPin, ExternalLink, Users } from "lucide-react";
import { StatusIndicator, type DriveStatus } from "@/components/club/DriveBadges";
import { RankBadge } from "@/components/club/RankBadge";
import { LikeButton } from "@/components/club/LikeButton";
import { rankNameFromLevel } from "@/lib/constants";
import { formatDate, formatTime, formatConvoyStatus } from "@/lib/format";
import { toggleDriveReaction } from "../actions";

export function DriveHero({
  driveId,
  driveIdCode,
  title,
  status,
  targetRank,
  bannerUrl,
  defaultBannerUrl,
  driveDate,
  meetingTime,
  meetingPointName,
  mapUrl,
  leadMarshal,
  registeredDrivers,
  maxDrivers,
  likeCount,
  viewerLiked,
}: {
  driveId: string;
  driveIdCode: string;
  title: string;
  status: DriveStatus;
  targetRank: number;
  bannerUrl: string | null;
  defaultBannerUrl: string | null;
  driveDate: string;
  meetingTime: string | null;
  meetingPointName: string | null;
  mapUrl: string | null;
  leadMarshal: { username: string; full_name: string | null; current_rank: number } | null;
  registeredDrivers: number;
  maxDrivers: number;
  likeCount: number;
  viewerLiked: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-sand bg-off-white shadow-sm">
      <div className="relative h-48 w-full sm:h-64">
        {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage / local default, no fixed remote domain to allowlist */}
        <img
          src={bannerUrl || defaultBannerUrl || "/defaults/desert-banner.svg"}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-charcoal/90 via-charcoal/15 to-transparent"
        />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
          <span className="rounded-full bg-charcoal/50 px-2.5 py-1 font-mono text-xs font-medium tracking-wide text-off-white uppercase backdrop-blur-sm">
            {driveIdCode}
          </span>
          <RankBadge
            rank={rankNameFromLevel(targetRank)}
            className="rounded-full bg-charcoal/50 px-2.5 py-1 text-xs text-off-white backdrop-blur-sm"
            size="xs"
          />
        </div>

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4 sm:p-5">
          <h1 className="text-xl font-bold text-off-white drop-shadow-sm sm:text-2xl">
            {title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatusIndicator
              status={status}
              className="w-fit rounded-full bg-charcoal/40 px-2 py-0.5 text-xs font-medium backdrop-blur-sm"
            />
            <LikeButton
              initialLiked={viewerLiked}
              initialCount={likeCount}
              toggleAction={() => toggleDriveReaction(driveId)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 sm:p-6">
        <div className="flex items-center gap-2 rounded-xl bg-sand-light/60 px-3 py-2.5">
          {leadMarshal ? (
            <RankBadge rank={rankNameFromLevel(leadMarshal.current_rank)} size="md" showLabel={false} />
          ) : (
            <Users className="h-5 w-5 shrink-0 text-charcoal-light/60" />
          )}
          <span className="min-w-0 text-sm">
            <span className="block text-xs text-charcoal-light/60">Lead Marshal</span>
            <span className="block truncate font-medium text-charcoal">
              {leadMarshal ? (leadMarshal.full_name ?? leadMarshal.username) : "TBD"}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-sand-light/60 px-3 py-2.5">
          <Calendar className="h-5 w-5 shrink-0 text-charcoal-light/60" />
          <span className="min-w-0 text-sm">
            <span className="block text-xs text-charcoal-light/60">Date</span>
            <span className="block truncate font-medium text-charcoal">
              {formatDate(driveDate)}
              {meetingTime && (
                <span className="text-charcoal-light/70">
                  {" "}
                  · <Clock className="inline h-3 w-3 -translate-y-px" /> {formatTime(meetingTime)}
                </span>
              )}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-sand-light/60 px-3 py-2.5">
          <MapPin className="h-5 w-5 shrink-0 text-charcoal-light/60" />
          <span className="min-w-0 flex-1 text-sm">
            <span className="block text-xs text-charcoal-light/60">Meeting Point</span>
            <span className="block truncate font-medium text-charcoal">
              {meetingPointName ?? "TBD"}
            </span>
          </span>
          {mapUrl && (
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open meeting point in Maps"
              className="shrink-0 text-forest hover:text-forest-dark"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-sand-light/60 px-3 py-2.5">
          <Users className="h-5 w-5 shrink-0 text-charcoal-light/60" />
          <span className="min-w-0 text-sm">
            <span className="block text-xs text-charcoal-light/60">Convoy Status</span>
            <span className="block truncate font-medium text-charcoal">
              {formatConvoyStatus(registeredDrivers, maxDrivers)}
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}
