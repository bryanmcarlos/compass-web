"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { Camera, X, LoaderCircle, CircleAlert, UploadCloud } from "lucide-react";
import { uploadImageToCloudinary } from "@/app/(app)/trip-reports/actions";

type PhotoItem = {
  id: string;
  /** Local object URL — shown immediately on drop, well before the network
   * round-trip resolves, so the driver sees their photo right away. */
  previewUrl: string;
  status: "uploading" | "success" | "error";
  secureUrl?: string;
  errorMessage?: string;
};

/** Drag-and-drop replacement for the old "Photo URLs" textarea. Each file
 * uploads to Cloudinary the moment it's dropped/selected (not deferred to
 * the report's own submit) — successful ones render a hidden
 * `name="photoUrls"` input apiece, which is exactly the field
 * submitTripReport already reads via formData.getAll, so the outer form
 * needs zero awareness of Cloudinary at all. */
export function PhotoDropzone({
  initialPhotos,
  onUploadingChange,
}: {
  /** Pre-existing Cloudinary URLs, e.g. when editing a report that already
   * has photos — rendered as already-"success" items up front, removable
   * same as a freshly-uploaded one, with no re-upload needed. */
  initialPhotos?: string[];
  /** Lets the parent form disable Submit while anything is still uploading
   * — without this, submitting mid-upload would silently drop that photo,
   * since its hidden input doesn't exist until the upload succeeds. */
  onUploadingChange?: (isUploading: boolean) => void;
}) {
  const [photos, setPhotos] = useState<PhotoItem[]>(() =>
    (initialPhotos ?? []).map((url) => ({
      id: url,
      previewUrl: url,
      status: "success" as const,
      secureUrl: url,
    })),
  );
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onUploadingChange?.(photos.some((p) => p.status === "uploading"));
  }, [photos, onUploadingChange]);

  useEffect(() => {
    // Revoke local object URLs on unmount so they don't leak — they're only
    // ever needed for the preview thumbnail, never submitted anywhere.
    return () => {
      for (const photo of photos) {
        URL.revokeObjectURL(photo.previewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup should only run once, on unmount, over whatever photos exist at that point
  }, []);

  async function uploadFile(id: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const result = await uploadImageToCloudinary(formData);

    setPhotos((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (result.status === "success" && result.url) {
          return { ...p, status: "success", secureUrl: result.url };
        }
        return { ...p, status: "error", errorMessage: result.message ?? "Upload failed." };
      }),
    );
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    for (const file of Array.from(fileList)) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const previewUrl = URL.createObjectURL(file);
      setPhotos((prev) => [...prev, { id, previewUrl, status: "uploading" }]);
      void uploadFile(id, file);
    }
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium text-charcoal">
        Photos <span className="font-normal text-charcoal-light/60">(optional)</span>
      </label>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-all duration-300 ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-sand bg-sand-light/40 hover:border-primary/50"
        }`}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          {isDragging ? (
            <UploadCloud className="h-5 w-5" />
          ) : (
            <Camera className="h-5 w-5" />
          )}
        </span>
        <p className="text-sm text-charcoal-light/80">
          Drag and drop your drive photos here, or{" "}
          <span className="font-semibold text-primary">click to browse files</span>
        </p>
        <p className="text-xs text-charcoal-light/50">
          JPEG, PNG, WEBP, or GIF — up to 10MB each
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            // Reset so re-selecting the exact same file still fires onChange.
            e.target.value = "";
          }}
        />
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="relative aspect-square overflow-hidden rounded-lg border border-sand bg-sand-light"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview / Cloudinary URL, no fixed remote domain to allowlist */}
              <img src={photo.previewUrl} alt="" className="h-full w-full object-cover" />

              {photo.status === "uploading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-charcoal/50">
                  <LoaderCircle className="h-5 w-5 animate-spin text-off-white" />
                </div>
              )}
              {photo.status === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-error/85 p-2 text-center">
                  <CircleAlert className="h-4 w-4 shrink-0 text-off-white" />
                  <span className="text-[10px] leading-tight text-off-white">
                    {photo.errorMessage}
                  </span>
                </div>
              )}
              {photo.status === "success" && (
                <input type="hidden" name="photoUrls" value={photo.secureUrl} />
              )}

              <button
                type="button"
                onClick={() => removePhoto(photo.id)}
                aria-label="Remove photo"
                className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-charcoal/70 text-off-white transition-colors hover:bg-error"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
