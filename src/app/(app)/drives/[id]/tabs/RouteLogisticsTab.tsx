import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import {
  MapPinned,
  Clock,
  Radio,
  ClipboardList,
  CheckSquare,
  Tent,
  ExternalLink,
  ScrollText,
  Fuel,
  DoorOpen,
} from "lucide-react";
import { markdownComponents } from "@/components/club/markdownComponents";
import { CollapsibleSection } from "@/components/club/CollapsibleSection";
import { formatDate, formatTime } from "@/lib/format";
import { formatDriveNotes } from "@/lib/driveNotesText";
import { htmlSanitizeSchema } from "@/lib/htmlSanitizeSchema";

export type RouteLogisticsDrive = {
  meeting_point_name: string | null;
  coordinates: string | null;
  exit_location: string | null;
  nearest_petrol_station: string | null;
  map_url: string | null;
  meeting_time: string | null;
  drive_start_time: string | null;
  drive_end_time: string | null;
  radio_frequency: string | null;
  equipment_requirements: string[] | null;
  drive_notes: string | null;
  has_camp: boolean;
  camp_date: string | null;
  camp_time: string | null;
  camp_location: string | null;
  camp_coordinates: string | null;
  camp_schedule_type: string | null;
};

export function RouteLogisticsTab({ drive }: { drive: RouteLogisticsDrive }) {
  return (
    <div className="flex flex-col gap-4">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-sand bg-off-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
            <MapPinned className="h-4 w-4 text-forest" />
            Meeting Point
          </h2>
          {drive.meeting_point_name && (
            <p className="text-sm text-charcoal">{drive.meeting_point_name}</p>
          )}
          {drive.coordinates && (
            <p className="font-mono text-xs text-charcoal-light/70">{drive.coordinates}</p>
          )}
          {drive.map_url && (
            <a
              href={drive.map_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-fit items-center gap-1.5 text-sm font-medium text-forest hover:underline"
            >
              Open in Maps
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {(drive.exit_location || drive.nearest_petrol_station) && (
            <dl className="flex flex-col gap-1.5 border-t border-sand pt-2 text-sm">
              {drive.exit_location && (
                <div className="flex items-start gap-1.5">
                  <DoorOpen className="mt-0.5 h-4 w-4 shrink-0 text-charcoal-light/60" />
                  <span>
                    <dt className="inline text-charcoal-light/70">Exit: </dt>
                    <dd className="inline font-medium text-charcoal">{drive.exit_location}</dd>
                  </span>
                </div>
              )}
              {drive.nearest_petrol_station && (
                <div className="flex items-start gap-1.5">
                  <Fuel className="mt-0.5 h-4 w-4 shrink-0 text-charcoal-light/60" />
                  <span>
                    <dt className="inline text-charcoal-light/70">Nearest petrol: </dt>
                    <dd className="inline font-medium text-charcoal">
                      {drive.nearest_petrol_station}
                    </dd>
                  </span>
                </div>
              )}
            </dl>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-sand bg-off-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
            <Clock className="h-4 w-4 text-forest" />
            Timing
          </h2>
          {(() => {
            const rows: [string, string | null][] = [
              ["Meeting Time", formatTime(drive.meeting_time)],
              ["Drive Start", formatTime(drive.drive_start_time)],
              ["Expected End", formatTime(drive.drive_end_time)],
            ];
            const visibleRows = rows.filter(
              (row): row is [string, string] => row[1] !== null,
            );

            if (visibleRows.length === 0) {
              return (
                <p className="text-sm text-charcoal-light/70 italic">
                  Timing details to be confirmed by Marshal.
                </p>
              );
            }

            return (
              <dl className="flex flex-col gap-1.5 text-sm">
                {visibleRows.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-charcoal-light/70">{label}</dt>
                    <dd className="font-medium text-charcoal">{value}</dd>
                  </div>
                ))}
              </dl>
            );
          })()}
          {drive.radio_frequency && (
            <p className="flex items-center gap-1.5 border-t border-sand pt-2 text-sm text-charcoal-light/90">
              <Radio className="h-4 w-4 shrink-0 text-charcoal-light/60" />
              Channel {drive.radio_frequency}
            </p>
          )}
        </div>

        {drive.has_camp && (
          <div className="flex flex-col gap-3 rounded-2xl border border-forest/30 bg-forest/5 p-5 shadow-sm sm:col-span-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
              <Tent className="h-4 w-4 text-forest" />
              ⛺ Camping Details
            </h2>
            {drive.camp_schedule_type && (
              <span className="inline-flex w-fit items-center rounded-full bg-forest/10 px-2.5 py-1 text-xs font-semibold text-forest">
                {drive.camp_schedule_type}
              </span>
            )}
            <dl className="flex flex-col gap-1.5 text-sm">
              {drive.camp_date && (
                <div className="flex justify-between gap-3">
                  <dt className="text-charcoal-light/70">Date</dt>
                  <dd className="font-medium text-charcoal">{formatDate(drive.camp_date)}</dd>
                </div>
              )}
              {drive.camp_time && (
                <div className="flex justify-between gap-3">
                  <dt className="text-charcoal-light/70">Time</dt>
                  <dd className="font-medium text-charcoal">{formatTime(drive.camp_time)}</dd>
                </div>
              )}
            </dl>
            {drive.camp_location && (
              <p className="text-sm text-charcoal">{drive.camp_location}</p>
            )}
            {drive.camp_coordinates && (
              <>
                <p className="font-mono text-xs text-charcoal-light/70">
                  {drive.camp_coordinates}
                </p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(drive.camp_coordinates)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-fit items-center gap-1.5 text-sm font-medium text-forest hover:underline"
                >
                  Open in Maps
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </>
            )}
          </div>
        )}
      </section>

      {drive.equipment_requirements && drive.equipment_requirements.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-sand bg-off-white p-5 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
            <ClipboardList className="h-4 w-4 text-forest" />
            Equipment Requirements
          </h2>
          <ul className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {drive.equipment_requirements.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-charcoal-light/90">
                <CheckSquare className="h-4 w-4 shrink-0 text-forest" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {drive.drive_notes && (
        <CollapsibleSection
          title="Drive Notes"
          icon={<ScrollText className="h-4 w-4 text-forest" />}
          defaultOpen
        >
          <div className="text-sm text-charcoal-light/90">
            <Markdown
              components={markdownComponents}
              rehypePlugins={[rehypeRaw, [rehypeSanitize, htmlSanitizeSchema]]}
            >
              {formatDriveNotes(drive.drive_notes)}
            </Markdown>
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
