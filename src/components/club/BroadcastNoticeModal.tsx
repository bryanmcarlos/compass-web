"use client";

import { useEffect, useRef, useState } from "react";
import { Megaphone, MessageCircle, Copy, Check, CircleAlert, X, ExternalLink } from "lucide-react";
import { compileBroadcastTemplate, type BroadcastTemplateData } from "@/lib/broadcastTemplate";

/** One small helper reused by both the Messenger and generic Copy buttons —
 * Messenger has no real "share arbitrary text" API without a registered
 * Facebook App ID and verified domain (neither exists in this project), so
 * its button is this same clipboard copy, just labeled for that platform —
 * the same fallback the feature was always going to need anyway. */
function useClipboardCopy(text: string) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setError(null);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy automatically — select and copy the preview text manually.");
    }
  }

  return { copied, error, copy };
}

export function BroadcastNoticeModal({
  template,
  data,
}: {
  template: string;
  data: BroadcastTemplateData;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen]);

  const compiled = compileBroadcastTemplate(template, data);
  const whatsappLink = `https://wa.me/?text=${encodeURIComponent(compiled)}`;

  const messenger = useClipboardCopy(compiled);
  const generic = useClipboardCopy(compiled);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex w-fit items-center gap-2 rounded-lg border border-forest/40 bg-off-white px-4 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-forest/10"
      >
        <Megaphone className="h-4 w-4" />
        Broadcast Notice
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setIsOpen(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setIsOpen(false);
        }}
        className="m-auto w-full max-w-md rounded-2xl border border-sand bg-off-white p-0 shadow-sm backdrop:bg-charcoal/50"
      >
        <div className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
              <Megaphone className="h-4 w-4 text-forest" />
              Broadcast Notice
            </h2>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-charcoal-light/60 hover:bg-sand-light"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-charcoal-light/70 uppercase">Preview</p>
            <pre className="max-h-64 overflow-y-auto rounded-lg border border-sand bg-sand-light/50 p-3 text-xs whitespace-pre-wrap text-charcoal">
              {compiled}
            </pre>
          </div>

          <div className="flex flex-col gap-2">
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-off-white transition-colors hover:brightness-95"
            >
              <ExternalLink className="h-4 w-4" />
              Share on WhatsApp
            </a>

            <button
              type="button"
              onClick={messenger.copy}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#0084FF] px-4 py-2.5 text-sm font-semibold text-off-white transition-colors hover:brightness-95"
            >
              {messenger.copied ? <Check className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
              {messenger.copied ? "Copied — paste into Messenger" : "Copy for Messenger"}
            </button>
            {messenger.error && (
              <span className="flex items-center gap-1.5 text-xs text-error">
                <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                {messenger.error}
              </span>
            )}

            <button
              type="button"
              onClick={generic.copy}
              className="flex items-center justify-center gap-2 rounded-lg border border-sand bg-off-white px-4 py-2.5 text-sm font-semibold text-charcoal transition-colors hover:bg-sand-light"
            >
              {generic.copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {generic.copied ? "Copied!" : "Copy to Clipboard"}
            </button>
            {generic.error && (
              <span className="flex items-center gap-1.5 text-xs text-error">
                <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                {generic.error}
              </span>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
