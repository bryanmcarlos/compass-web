"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Check, CircleAlert } from "lucide-react";

export function CopyRosterButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setError(null);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail silently (insecure context, denied
      // permission) — surface it rather than pretending the copy worked.
      setError("Couldn't copy automatically — select and copy the roster text manually.");
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={handleCopy}
        className="flex w-fit items-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-off-white transition-colors hover:bg-forest-dark"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copy WhatsApp Convoy Roster
          </>
        )}
      </button>
      {error && (
        <span className="flex items-center gap-1.5 text-xs text-error">
          <CircleAlert className="h-3.5 w-3.5 shrink-0" />
          {error}
        </span>
      )}
    </div>
  );
}
