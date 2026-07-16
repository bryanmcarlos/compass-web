"use client";

import { useActionState, useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Palette,
  Image as ImageIcon,
  Upload,
  Save,
  LoaderCircle,
  CircleCheck,
  CircleAlert,
} from "lucide-react";
import {
  updateAppSettings,
  type AppSettingsState,
} from "@/app/(app)/admin/settings/actions";
import { FALLBACK_PRIMARY_COLOR } from "@/lib/appSettings";

const initialState: AppSettingsState = { status: "idle", message: null };

export function AdminSettingsForm({
  initialPrimaryColor,
  initialLogoUrl,
  initialDefaultBannerUrl,
}: {
  initialPrimaryColor: string;
  initialLogoUrl: string | null;
  initialDefaultBannerUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateAppSettings, initialState);
  const router = useRouter();

  const [primaryColor, setPrimaryColor] = useState(
    initialPrimaryColor || FALLBACK_PRIMARY_COLOR,
  );
  const [logoPreview, setLogoPreview] = useState<string | null>(initialLogoUrl);
  const [bannerPreview, setBannerPreview] = useState<string | null>(initialDefaultBannerUrl);

  // Syncing local state to an async external event (the Server Action's
  // result) — not deriving from already-available render state — is the
  // legitimate use case this lint rule can't tell apart from the general
  // "don't setState in an effect" heuristic. Same reasoning as DriveForm's
  // resync-from-server effect.
  useEffect(() => {
    if (state.status === "success") {
      // Re-fetches the root layout too, so the just-saved primary color and
      // logo take effect site-wide immediately, not just on this page.
      router.refresh();
      if (state.updated) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPrimaryColor(state.updated.primary_color);
        setLogoPreview(state.updated.logo_url);
        setBannerPreview(state.updated.default_drive_banner_url);
      }
    }
  }, [state.status, state.updated, router]);

  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
  }

  function handleBannerChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerPreview(URL.createObjectURL(file));
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-6 rounded-2xl border border-sand bg-off-white p-6 shadow-sm sm:p-8"
    >
      <div className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
          <Palette className="h-4 w-4 text-forest" />
          Primary Theme Color
        </h2>
        <p className="text-xs text-charcoal-light/70">
          Drives the site-wide accent (bg-primary / text-primary /
          border-primary) used wherever the theme opts into it.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="color"
            aria-label="Pick primary color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-sand bg-off-white p-1"
          />
          <input
            type="text"
            name="primaryColor"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            pattern="^#[0-9a-fA-F]{6}$"
            placeholder={FALLBACK_PRIMARY_COLOR}
            className="w-full max-w-40 rounded-lg border border-sand bg-off-white px-3 py-2 text-base text-charcoal placeholder:text-charcoal-light/40 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
          />
        </div>
      </div>

      <ImageUploadField
        label="COMPASS Logo / Banner"
        description="Replaces the header logo across the app."
        name="logo"
        preview={logoPreview}
        onChange={handleLogoChange}
      />

      <ImageUploadField
        label="Default Drive Banner"
        description="Shown on any drive that doesn't have its own banner image."
        name="defaultDriveBanner"
        preview={bannerPreview}
        onChange={handleBannerChange}
      />

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
        className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-off-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {pending ? "Saving…" : "Save Settings"}
      </button>
    </form>
  );
}

function ImageUploadField({
  label,
  description,
  name,
  preview,
  onChange,
}: {
  label: string;
  description: string;
  name: string;
  preview: string | null;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-sand pt-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
        <ImageIcon className="h-4 w-4 text-forest" />
        {label}
      </h2>
      <p className="text-xs text-charcoal-light/70">{description}</p>
      <div className="relative h-32 w-full overflow-hidden rounded-lg border border-sand bg-sand-light sm:h-40">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- object URL preview or Supabase Storage URL, no fixed remote domain to allowlist
          <img src={preview} alt="" className="h-full w-full bg-off-white object-contain" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-charcoal-light/50">
            No image set
          </div>
        )}
      </div>
      <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-primary/40 bg-off-white px-3 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10">
        <Upload className="h-4 w-4" />
        {preview ? "Change Image" : "Upload Image"}
        <input
          type="file"
          name={name}
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={onChange}
          className="hidden"
        />
      </label>
    </div>
  );
}
