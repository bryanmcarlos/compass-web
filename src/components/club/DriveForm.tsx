"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  Hash,
  Save,
  Plus,
  X,
  LoaderCircle,
  CircleCheck,
  CircleAlert,
  MapPinned,
  Clock,
  ClipboardList,
  GraduationCap,
  Tent,
  Image as ImageIcon,
  Upload,
} from "lucide-react";
import { createDrive, updateDrive, type DriveFormState } from "@/app/(app)/drives/actions";
import { CLUB_CONFIG, COMPASS_RANKS } from "@/lib/constants";
import { applyDriveTitlePrefix, stripDriveTitlePrefix } from "@/lib/driveTitle";
import type { DriveDifficulty, DriveStatus } from "@/components/club/DriveBadges";

const DIFFICULTIES: DriveDifficulty[] = [
  "Easy",
  "Moderate",
  "Challenging",
  "Hard",
  "Extreme",
];
const STATUSES: DriveStatus[] = ["Scheduled", "Completed", "Cancelled"];

const STANDARD_EQUIPMENT: string[] = [
  "4x4 vehicle",
  "UHF Radio",
  "Trail Flag",
  "Portable Air Compressor",
  "Floor Jack and Jacking baseboard",
  "Recovery Rope",
  "GPS (GAIA app or other GPS device)",
  "Full tank of petrol",
  "Valid Car Insurance",
  "Snacks",
  "Bottled Water/Drinks (non-alcoholic)",
  "Bring your Camping Gear, your food and to share for 1-2 person only",
];

/** Native `<input type="time">` expects "HH:MM" — Postgres TIME columns come
 * back as "HH:MM:SS", which the input silently rejects without a matching
 * `step`. Truncate rather than fight the input's granularity. */
function toHHMM(value: string | null | undefined): string {
  return value?.slice(0, 5) ?? "";
}

export type DriveFormValues = {
  id: string;
  drive_id_code: string;
  title: string;
  difficulty: DriveDifficulty;
  status: DriveStatus;
  drive_date: string;
  location: string;
  meeting_point_name: string | null;
  coordinates: string | null;
  map_url: string | null;
  meeting_time: string | null;
  drive_start_time: string | null;
  drive_end_time: string | null;
  radio_frequency: string | null;
  target_rank: number;
  max_drivers: number;
  equipment_requirements: string[] | null;
  must_skills_covered: string[] | null;
  banner_url: string | null;
  has_camp: boolean;
  camp_date: string | null;
  camp_time: string | null;
  camp_location: string | null;
  camp_coordinates: string | null;
  camp_schedule_type: string | null;
};

const CAMP_SCHEDULE_TYPES = ["Before the Drive", "After the Drive"];

type TextFieldsState = {
  title: string;
  difficulty: string;
  status: string;
  driveDate: string;
  location: string;
  maxDrivers: string;
  meetingPointName: string;
  coordinates: string;
  mapUrl: string;
  meetingTime: string;
  driveStartTime: string;
  driveEndTime: string;
  radioFrequency: string;
  campDate: string;
  campTime: string;
  campLocation: string;
  campCoordinates: string;
  campScheduleType: string;
};

function buildInitialFields(initialValues?: DriveFormValues): TextFieldsState {
  return {
    // The field only ever shows the marshal's clean base title — the
    // "NWB - " / "ROK - " / etc. prefix is applied server-side from the
    // Target Rank, never typed or displayed here.
    title: stripDriveTitlePrefix(initialValues?.title ?? ""),
    difficulty: initialValues?.difficulty ?? "Easy",
    status: initialValues?.status ?? "Scheduled",
    driveDate: initialValues?.drive_date ?? "",
    location: initialValues?.location ?? "",
    maxDrivers: String(initialValues?.max_drivers ?? 5),
    meetingPointName: initialValues?.meeting_point_name ?? "",
    coordinates: initialValues?.coordinates ?? "",
    mapUrl: initialValues?.map_url ?? "",
    meetingTime: toHHMM(initialValues?.meeting_time),
    driveStartTime: toHHMM(initialValues?.drive_start_time),
    driveEndTime: toHHMM(initialValues?.drive_end_time),
    radioFrequency: initialValues?.radio_frequency ?? "44 00 55",
    campDate: initialValues?.camp_date ?? "",
    campTime: toHHMM(initialValues?.camp_time),
    campLocation: initialValues?.camp_location ?? "",
    campCoordinates: initialValues?.camp_coordinates ?? "",
    campScheduleType: initialValues?.camp_schedule_type ?? CAMP_SCHEDULE_TYPES[0],
  };
}

const initialState: DriveFormState = { status: "idle", message: null };

export function DriveForm({
  mode,
  initialValues,
}: {
  mode: "create" | "edit";
  initialValues?: DriveFormValues;
}) {
  const action = mode === "create" ? createDrive : updateDrive;
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();

  // Every field below is controlled by React state rather than
  // defaultValue/defaultChecked. This isn't just style: `<form action={fn}>`
  // resets uncontrolled fields whenever the action's promise settles,
  // regardless of whether the returned state represents success or an
  // app-level error — React only knows the async function didn't throw. With
  // controlled inputs, even if React resets the underlying DOM value, the
  // very next render re-applies the real value from state, so a failed
  // submission never wipes what the marshal typed.
  const [fields, setFields] = useState<TextFieldsState>(() =>
    buildInitialFields(initialValues),
  );
  const [targetRank, setTargetRank] = useState<number>(
    initialValues?.target_rank ?? 1,
  );
  const [hasCamp, setHasCamp] = useState<boolean>(
    initialValues?.has_camp ?? false,
  );
  const [equipment, setEquipment] = useState<string[]>(() =>
    mode === "create"
      ? STANDARD_EQUIPMENT
      : (initialValues?.equipment_requirements ?? []),
  );
  const [customEquipment, setCustomEquipment] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>(
    () => initialValues?.must_skills_covered ?? [],
  );
  // bannerPreview drives what's shown — either a freshly picked file's
  // object URL, the drive's existing banner_url, or null (no banner / marked
  // for removal). It's kept separate from the actual File so the JSX doesn't
  // need to read File contents to render a thumbnail.
  const [bannerPreview, setBannerPreview] = useState<string | null>(
    initialValues?.banner_url ?? null,
  );
  const [removeBanner, setRemoveBanner] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const skillOptions =
    COMPASS_RANKS[targetRank as 1 | 2 | 3 | 4 | 5]?.mustSkills ?? [];

  // createDrive redirects to the new drive on success, which already forces
  // a fresh render there. updateDrive doesn't navigate away — the marshal
  // stays on this edit page — so explicitly refresh the router here too.
  // revalidatePath() in the Server Action already invalidates the detail
  // page's cached data; this makes sure the client picks that up immediately
  // rather than only on the next navigation.
  useEffect(() => {
    if (mode === "edit" && state.status === "success") {
      router.refresh();
    }
  }, [mode, state.status, router]);

  // Re-sync from what the server actually confirmed as saved — this is the
  // real equivalent, in a plain useState + Server Action form (there's no
  // react-hook-form here), of resetting a form from a fresh server payload
  // instead of trusting that pre-submit client state still mirrors the row.
  // This isn't a redundant derivation from already-available props/state —
  // it's syncing local state to an async external event (the action's
  // result), which is the legitimate use case the lint rule can't tell apart
  // from the general "don't setState in an effect" heuristic.
  useEffect(() => {
    if (state.status === "success" && state.updatedFields) {
      const saved = state.updatedFields;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFields((prev) => ({
        ...prev,
        title: stripDriveTitlePrefix(saved.title),
        meetingTime: toHHMM(saved.meeting_time),
        driveStartTime: toHHMM(saved.drive_start_time),
        driveEndTime: toHHMM(saved.drive_end_time),
      }));
      setBannerPreview(saved.banner_url);
      setRemoveBanner(false);
      if (bannerInputRef.current) {
        bannerInputRef.current.value = "";
      }
    }
  }, [state.status, state.updatedFields]);

  function handleFieldChange(
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  function removeEquipmentAt(index: number) {
    setEquipment((prev) => prev.filter((_, i) => i !== index));
  }

  function addCustomEquipment() {
    const trimmed = customEquipment.trim();
    if (!trimmed) return;
    if (equipment.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      setCustomEquipment("");
      return;
    }
    setEquipment((prev) => [...prev, trimmed]);
    setCustomEquipment("");
  }

  function toggleSkill(skill: string) {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    );
  }

  function handleBannerChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRemoveBanner(false);
    setBannerPreview(URL.createObjectURL(file));
  }

  function handleRemoveBanner() {
    // A native file input's selected file can only be cleared by resetting
    // the input element itself — its `value` can only ever be set to "".
    if (bannerInputRef.current) {
      bannerInputRef.current.value = "";
    }
    setRemoveBanner(true);
    setBannerPreview(null);
  }

  // Safari's native <input type="time"> only reports a value once every
  // segment (hour, minute, AM/PM) has been explicitly set — leave one
  // untouched and .value silently reports "", indistinguishable from the
  // marshal deliberately clearing the field. Chrome's fluid typing rarely
  // hits this; Safari's Tab-driven segment navigation makes it easy to. This
  // catches "a field that had a saved time is now empty" before it reaches
  // the server and quietly nulls out a previously-good value.
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    const cleared: string[] = [];
    if (initialValues?.meeting_time && !fields.meetingTime.trim()) {
      cleared.push("Meeting time");
    }
    if (initialValues?.drive_start_time && !fields.driveStartTime.trim()) {
      cleared.push("Start time");
    }
    if (initialValues?.drive_end_time && !fields.driveEndTime.trim()) {
      cleared.push("End time");
    }

    if (cleared.length > 0) {
      const noun = cleared.length === 1 ? "it" : "them";
      const confirmed = window.confirm(
        `${cleared.join(", ")} will be cleared because ${cleared.length === 1 ? "it looks" : "they look"} empty. ` +
          `In Safari this can happen if a time field's hour, minute, or AM/PM segment wasn't fully filled in, ` +
          `rather than a deliberate clear. Continue and clear ${noun}?`,
      );
      if (!confirmed) {
        e.preventDefault();
      }
    }
  }

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-6 rounded-2xl border border-sand bg-off-white p-6 shadow-sm sm:p-8"
    >
      {mode === "edit" && (
        <input type="hidden" name="driveId" value={initialValues!.id} />
      )}

      <div className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
          <Hash className="h-4 w-4 text-forest" />
          Basics
        </h2>

        <div className="flex flex-col gap-1.5">
          <TextField
            id="title"
            name="title"
            label="Title"
            placeholder="e.g. Sweihan Sand Bash"
            value={fields.title}
            onChange={handleFieldChange}
            required
          />
          {fields.title.trim() && (
            <p className="text-xs text-charcoal-light/60">
              Will be saved as:{" "}
              <span className="font-medium text-charcoal-light/80">
                {applyDriveTitlePrefix(fields.title, targetRank)}
              </span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            id="difficulty"
            name="difficulty"
            label="Difficulty"
            value={fields.difficulty}
            onChange={handleFieldChange}
            options={DIFFICULTIES.map((d) => ({ value: d, label: d }))}
          />
          <SelectField
            id="status"
            name="status"
            label="Status"
            value={fields.status}
            onChange={handleFieldChange}
            options={STATUSES.map((s) => ({ value: s, label: s }))}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            id="driveDate"
            name="driveDate"
            label="Date"
            type="date"
            value={fields.driveDate}
            onChange={handleFieldChange}
            required
          />
          <TextField
            id="location"
            name="location"
            label="Location"
            placeholder="e.g. Sweihan Desert"
            value={fields.location}
            onChange={handleFieldChange}
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            id="targetRank"
            name="targetRank"
            label="Target Rank"
            value={String(targetRank)}
            onChange={(e) => setTargetRank(Number(e.target.value))}
            options={CLUB_CONFIG.ranks.map((r) => ({
              value: String(r.level),
              label: r.title,
            }))}
          />
          <TextField
            id="maxDrivers"
            name="maxDrivers"
            label="Max Driver Slots"
            type="number"
            min={1}
            value={fields.maxDrivers}
            onChange={handleFieldChange}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-sand pt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
          <ImageIcon className="h-4 w-4 text-forest" />
          Banner Image
        </h2>
        <p className="text-xs text-charcoal-light/70">
          Shown at the top of the drive page. Falls back to a default desert
          scene if none is set.
        </p>

        <div className="relative h-40 w-full overflow-hidden rounded-lg border border-sand bg-sand-light sm:h-48">
          {bannerPreview ? (
            // eslint-disable-next-line @next/next/no-img-element -- object URL preview or Supabase Storage URL, no fixed remote domain to allowlist
            <img src={bannerPreview} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-charcoal-light/50">
              No banner set — default scene will be used
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-forest/40 bg-off-white px-3 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-forest/10">
            <Upload className="h-4 w-4" />
            {bannerPreview ? "Change Banner" : "Upload Banner"}
            <input
              ref={bannerInputRef}
              type="file"
              name="bannerImage"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleBannerChange}
              className="hidden"
            />
          </label>
          {bannerPreview && (
            <button
              type="button"
              onClick={handleRemoveBanner}
              className="flex items-center gap-1.5 text-sm font-medium text-charcoal-light/70 hover:text-error"
            >
              <X className="h-4 w-4" />
              Remove
            </button>
          )}
        </div>
        {removeBanner && <input type="hidden" name="removeBanner" value="on" />}
      </div>

      <div className="flex flex-col gap-4 border-t border-sand pt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
          <MapPinned className="h-4 w-4 text-forest" />
          Meeting Point
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            id="meetingPointName"
            name="meetingPointName"
            label="Meeting point name"
            placeholder="e.g. Badayer (Shop)"
            value={fields.meetingPointName}
            onChange={handleFieldChange}
          />
          <TextField
            id="coordinates"
            name="coordinates"
            label="Coordinates"
            placeholder="e.g. 24.9549574, 55.7128488"
            value={fields.coordinates}
            onChange={handleFieldChange}
          />
        </div>
        <TextField
          id="mapUrl"
          name="mapUrl"
          label="Map URL"
          type="text"
          placeholder="maps.app.goo.gl/... or https://maps.google.com/..."
          value={fields.mapUrl}
          onChange={handleFieldChange}
        />
      </div>

      <div className="flex flex-col gap-4 border-t border-sand pt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
          <Clock className="h-4 w-4 text-forest" />
          Timing &amp; Radio
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField
            id="meetingTime"
            name="meetingTime"
            label="Meeting time"
            type="time"
            value={fields.meetingTime}
            onChange={handleFieldChange}
          />
          <TextField
            id="driveStartTime"
            name="driveStartTime"
            label="Start time"
            type="time"
            value={fields.driveStartTime}
            onChange={handleFieldChange}
          />
          <TextField
            id="driveEndTime"
            name="driveEndTime"
            label="End time"
            type="time"
            value={fields.driveEndTime}
            onChange={handleFieldChange}
          />
        </div>
        <TextField
          id="radioFrequency"
          name="radioFrequency"
          label="Radio frequency"
          placeholder="44 00 55"
          value={fields.radioFrequency}
          onChange={handleFieldChange}
        />
      </div>

      <div className="flex flex-col gap-4 border-t border-sand pt-6">
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            name="hasCamp"
            checked={hasCamp}
            onChange={(e) => setHasCamp(e.target.checked)}
            className="h-4 w-4 shrink-0 rounded border-sand text-forest focus:ring-2 focus:ring-forest/20"
          />
          <span className="flex items-center gap-2 text-sm font-semibold text-charcoal">
            <Tent className="h-4 w-4 text-forest" />
            Include Camping
          </span>
        </label>

        {hasCamp && (
          <div className="flex flex-col gap-4 rounded-lg bg-sand-light p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                id="campDate"
                name="campDate"
                label="Camping date"
                type="date"
                value={fields.campDate}
                onChange={handleFieldChange}
                required
              />
              <TextField
                id="campTime"
                name="campTime"
                label="Camping time"
                type="time"
                value={fields.campTime}
                onChange={handleFieldChange}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                id="campLocation"
                name="campLocation"
                label="Camping location"
                placeholder="e.g. Sweihan Sandbox"
                value={fields.campLocation}
                onChange={handleFieldChange}
                required
              />
              <TextField
                id="campCoordinates"
                name="campCoordinates"
                label="Camping coordinates"
                placeholder="e.g. 24.4123, 55.3123"
                value={fields.campCoordinates}
                onChange={handleFieldChange}
              />
            </div>
            <SelectField
              id="campScheduleType"
              name="campScheduleType"
              label="Schedule"
              value={fields.campScheduleType}
              onChange={handleFieldChange}
              options={CAMP_SCHEDULE_TYPES.map((t) => ({ value: t, label: t }))}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-sand pt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
          <ClipboardList className="h-4 w-4 text-forest" />
          Equipment Requirements
        </h2>
        <p className="text-xs text-charcoal-light/70">
          Standard gear is pre-filled for a new drive — remove anything that
          doesn&apos;t apply, or add drive-specific items below.
        </p>

        {equipment.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {equipment.map((item, index) => (
              <span
                key={`${item}-${index}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-sand bg-sand-light py-1.5 pr-1.5 pl-3 text-xs font-medium text-charcoal"
              >
                {item}
                <input
                  type="hidden"
                  name="equipmentRequirements"
                  value={item}
                />
                <button
                  type="button"
                  onClick={() => removeEquipmentAt(index)}
                  aria-label={`Remove ${item}`}
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-charcoal-light/60 hover:bg-error/10 hover:text-error"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={customEquipment}
            onChange={(e) => setCustomEquipment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomEquipment();
              }
            }}
            placeholder="e.g. Winch"
            className="w-full flex-1 rounded-lg border border-sand bg-off-white px-3 py-2 text-base text-charcoal placeholder:text-charcoal-light/40 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
          />
          <button
            type="button"
            onClick={addCustomEquipment}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-forest/40 bg-off-white px-3 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-forest/10"
          >
            <Plus className="h-4 w-4" />
            Add Custom Equipment
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-sand pt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
          <GraduationCap className="h-4 w-4 text-forest" />
          Must Skills Addressed
        </h2>
        <p className="text-xs text-charcoal-light/70">
          Skills a member can complete on this drive, drawn from the{" "}
          {CLUB_CONFIG.ranks.find((r) => r.level === targetRank)?.title ??
            "selected rank"}{" "}
          curriculum. Editable any time, including after the drive is marked
          Completed, in case a teaching opportunity came up on the trail.
        </p>
        {skillOptions.length === 0 ? (
          <p className="rounded-lg bg-sand-light px-3 py-2 text-sm text-charcoal-light/70">
            No curriculum skills are defined for this rank.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {skillOptions.map((skill) => (
              <label
                key={skill}
                className="flex items-start gap-2.5 rounded-lg border border-sand px-3 py-2.5 text-sm text-charcoal has-[:checked]:border-forest has-[:checked]:bg-forest/5"
              >
                <input
                  type="checkbox"
                  name="mustSkills"
                  value={skill}
                  checked={selectedSkills.includes(skill)}
                  onChange={() => toggleSkill(skill)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-sand text-forest focus:ring-2 focus:ring-forest/20"
                />
                {skill}
              </label>
            ))}
          </div>
        )}
      </div>

      {state.status !== "idle" && state.message && (
        <div
          role="alert"
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
            state.status === "error"
              ? "border-error/30 bg-error-bg text-error"
              : "border-forest/30 bg-forest/10 text-forest-dark"
          }`}
        >
          {state.status === "error" ? (
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="break-words">{state.message}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex items-center justify-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-off-white transition-colors hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : mode === "create" ? (
          <Plus className="h-4 w-4" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {pending
          ? "Saving…"
          : mode === "create"
            ? "Post Drive"
            : "Save Changes"}
      </button>
    </form>
  );
}

function TextField({
  id,
  name,
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  required,
  min,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  min?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-charcoal">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        min={min}
        className="w-full rounded-lg border border-sand bg-off-white px-3 py-2 text-base text-charcoal placeholder:text-charcoal-light/40 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
      />
    </div>
  );
}

function SelectField({
  id,
  name,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-charcoal">
        {label}
      </label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full rounded-lg border border-sand bg-off-white px-3 py-2 text-base text-charcoal focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
