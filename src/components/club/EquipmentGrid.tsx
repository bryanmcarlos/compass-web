"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CircleCheck, LoaderCircle, CircleAlert, HourglassIcon } from "lucide-react";
import {
  uploadEquipmentProof,
  submitEquipmentProof,
} from "@/app/(app)/profile/equipment/actions";

export type EquipmentItem = {
  name: string;
  status: "pending" | "uploaded" | "verified";
  proofUrl: string | null;
};

/** Local upload-in-flight state, keyed by item name — separate from the
 * server-derived `status` on each item so a re-upload shows its own
 * spinner/error immediately without waiting on a round-trip + refresh. */
type LocalState = { phase: "idle" | "uploading" | "error"; message?: string };

function StatusBadge({ status }: { status: EquipmentItem["status"] }) {
  if (status === "verified") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-forest/10 px-2 py-0.5 text-[10px] font-semibold text-forest">
        <CircleCheck className="h-3.5 w-3.5" />
        Verified
      </span>
    );
  }
  if (status === "uploaded") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-diff-moderate-bg px-2 py-0.5 text-[10px] font-semibold text-diff-moderate">
        <HourglassIcon className="h-3.5 w-3.5" />
        Under Review
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-error-bg px-2 py-0.5 text-[10px] font-semibold text-error">
      <CircleAlert className="h-3.5 w-3.5" />
      Missing
    </span>
  );
}

function EquipmentItemCard({ item }: { item: EquipmentItem }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [local, setLocal] = useState<LocalState>({ phase: "idle" });

  async function handleFile(file: File) {
    setLocal({ phase: "uploading" });

    const formData = new FormData();
    formData.append("file", file);
    const uploadResult = await uploadEquipmentProof(formData);

    if (uploadResult.status !== "success" || !uploadResult.url) {
      setLocal({ phase: "error", message: uploadResult.message ?? "Upload failed." });
      return;
    }

    const submitResult = await submitEquipmentProof(item.name, uploadResult.url);
    if (submitResult.status !== "success") {
      setLocal({ phase: "error", message: submitResult.message ?? "Couldn't save proof." });
      return;
    }

    setLocal({ phase: "idle" });
    router.refresh();
  }

  const borderClass =
    item.status === "verified"
      ? "border-forest/30 bg-forest/5"
      : item.status === "uploaded"
        ? "border-diff-moderate/30 bg-diff-moderate-bg/40"
        : "border-error/30 bg-error-bg/40";

  return (
    <div className={`flex flex-col gap-3 rounded-xl border p-4 ${borderClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="min-w-0 text-sm font-semibold text-charcoal">{item.name}</span>
        <StatusBadge status={item.status} />
      </div>

      {item.proofUrl && (
        <a
          href={item.proofUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block aspect-video overflow-hidden rounded-lg border border-sand bg-sand-light"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary-hosted proof photo, no fixed remote domain to allowlist */}
          <img src={item.proofUrl} alt={`Proof for ${item.name}`} className="h-full w-full object-cover" />
        </a>
      )}

      <button
        type="button"
        disabled={local.phase === "uploading"}
        onClick={() => inputRef.current?.click()}
        className="flex items-center justify-center gap-2 rounded-lg border border-sand bg-off-white px-3 py-2 text-xs font-semibold text-charcoal transition-colors hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {local.phase === "uploading" ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Camera className="h-3.5 w-3.5" />
        )}
        {local.phase === "uploading"
          ? "Uploading…"
          : item.proofUrl
            ? "Replace Photo"
            : "Upload Photo"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />

      {local.phase === "error" && (
        <p className="text-xs text-error">{local.message}</p>
      )}
    </div>
  );
}

export function EquipmentGrid({ items }: { items: EquipmentItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <EquipmentItemCard key={item.name} item={item} />
      ))}
    </div>
  );
}
