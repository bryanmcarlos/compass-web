"use client";

import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

/** Thumbnail grid + full-screen lightbox (arrows, click-to-zoom, a "Photo X
 * of Y" caption — there's no per-photo caption text in the data model,
 * `photos` is just a list of URLs, so position is the honest thing to show
 * rather than inventing caption copy). Its own client leaf so the
 * Server-Component TripReportCard that renders it doesn't need to become
 * one itself, same pattern as every other embedded-interactivity piece
 * this session (AssignDriverSlotModal, CommentThread, etc.). */
export function PhotoGallery({ photos, reportAuthor }: { photos: string[]; reportAuthor: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);

  const visible = photos.slice(0, 4);
  const extra = photos.length - visible.length;

  useEffect(() => {
    if (openIndex === null) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenIndex(null);
      if (e.key === "ArrowLeft") {
        setIsZoomed(false);
        setOpenIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
      }
      if (e.key === "ArrowRight") {
        setIsZoomed(false);
        setOpenIndex((i) => (i === null ? null : (i + 1) % photos.length));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    // Lightbox open shouldn't let the page scroll behind it.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [openIndex, photos.length]);

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {visible.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="relative aspect-square overflow-hidden rounded-lg border border-sand bg-sand-light"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary member-hosted URLs (Cloudinary/Imgur), no known remote domain to allowlist */}
            <img
              src={url}
              alt={`Photo ${i + 1} from ${reportAuthor}'s trip report`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
            />
            {i === visible.length - 1 && extra > 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-charcoal/60 text-sm font-semibold text-off-white">
                +{extra}
              </div>
            )}
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Photo ${openIndex + 1} of ${photos.length}`}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-charcoal/95 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenIndex(null);
          }}
        >
          <button
            type="button"
            onClick={() => setOpenIndex(null)}
            aria-label="Close"
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-off-white/10 text-off-white transition-colors hover:bg-off-white/20"
          >
            <X className="h-5 w-5" />
          </button>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => {
                  setIsZoomed(false);
                  setOpenIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
                }}
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-off-white/10 text-off-white transition-colors hover:bg-off-white/20 sm:left-4"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsZoomed(false);
                  setOpenIndex((i) => (i === null ? null : (i + 1) % photos.length));
                }}
                aria-label="Next photo"
                className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-off-white/10 text-off-white transition-colors hover:bg-off-white/20 sm:right-4"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <div className={`flex w-full flex-1 items-center justify-center ${isZoomed ? "overflow-auto" : "overflow-hidden"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary member-hosted URLs, no fixed remote domain to allowlist */}
            <img
              src={photos[openIndex]}
              alt={`Photo ${openIndex + 1} from ${reportAuthor}'s trip report`}
              onClick={() => setIsZoomed((z) => !z)}
              className={`cursor-zoom-in rounded-lg transition-transform ${
                isZoomed ? "max-w-none cursor-zoom-out scale-150" : "max-h-[80vh] max-w-full object-contain"
              }`}
            />
          </div>

          <div className="mt-3 flex items-center gap-3 text-sm text-off-white/80">
            <button
              type="button"
              onClick={() => setIsZoomed((z) => !z)}
              className="flex items-center gap-1.5 rounded-full bg-off-white/10 px-3 py-1 text-xs font-medium transition-colors hover:bg-off-white/20"
            >
              {isZoomed ? <ZoomOut className="h-3.5 w-3.5" /> : <ZoomIn className="h-3.5 w-3.5" />}
              {isZoomed ? "Zoom out" : "Zoom in"}
            </button>
            <span>
              Photo {openIndex + 1} of {photos.length}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
