export type BroadcastTemplateData = {
  drive_title: string;
  drive_code: string;
  drive_date: string;
  meeting_time: string;
  meeting_point: string;
  map_url: string;
  target_rank: string;
  lead_marshal: string;
  drive_link: string;
};

export const BROADCAST_TEMPLATE_TAGS: { tag: string; label: string }[] = [
  { tag: "drive_title", label: "Title of the drive" },
  { tag: "drive_code", label: "Custom code (e.g. DRV-2026-003)" },
  { tag: "drive_date", label: "Date of the drive" },
  { tag: "meeting_time", label: "Meeting time" },
  { tag: "meeting_point", label: "Meeting point name" },
  { tag: "map_url", label: "Google Maps link" },
  { tag: "target_rank", label: "Target rank" },
  { tag: "lead_marshal", label: "Lead marshal's name" },
  { tag: "drive_link", label: "Link to open the drive and register" },
];

export const DEFAULT_BROADCAST_TEMPLATE = `🏜️ COMPASS OFFICIAL DRIVE 🏜️

{{drive_title}}
📋 Code: {{drive_code}}
📅 Date: {{drive_date}}
⏰ Meeting Time: {{meeting_time}}
📍 Meeting Point: {{meeting_point}}
🗺️ Map: {{map_url}}
🎖️ Rank: {{target_rank}}
🧭 Lead Marshal: {{lead_marshal}}

👉 Open the drive & register: {{drive_link}}

See you on the trail!`;

/** An unrecognized {{tag}} is left as literal text rather than silently
 * dropped — a typo in a saved template should be visible/debuggable in the
 * preview, not quietly vanish. */
export function compileBroadcastTemplate(template: string, data: BroadcastTemplateData): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in data ? data[key as keyof BroadcastTemplateData] : match,
  );
}
