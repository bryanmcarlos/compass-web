"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Check, CircleAlert } from "lucide-react";

/** Icon-only copy button — the established substitute for a toast in this
 * codebase (no toast system exists anywhere): the icon itself flips to a
 * checkmark for 2s, same pattern as BroadcastNoticeModal's copy buttons. */
export function CopyToClipboardButton({
  text,
  label = "Copy",
  className = "",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setError(false);
      setCopied(true);
    } catch {
      setCopied(false);
      setError(true);
    } finally {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
        setError(false);
      }, 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      title={error ? "Couldn't copy — select the text manually" : copied ? "Copied!" : label}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-charcoal-light/60 transition-colors hover:bg-sand-light hover:text-forest ${className}`}
    >
      {error ? (
        <CircleAlert className="h-3.5 w-3.5 text-error" />
      ) : copied ? (
        <Check className="h-3.5 w-3.5 text-forest" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
