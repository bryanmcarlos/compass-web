"use client";

import { useActionState, useRef, useState, type ChangeEvent } from "react";
import { Camera, LoaderCircle, CircleAlert } from "lucide-react";
import { Avatar } from "./Avatar";
import { uploadAvatar, type UploadAvatarState } from "@/app/(app)/profile/actions";

const initialState: UploadAvatarState = { status: "idle", message: null };

export function AvatarUploadForm({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState(uploadAvatar, initialState);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    formRef.current?.requestSubmit();
  }

  const displayedUrl = state.status === "success" ? (state.avatarUrl ?? null) : (preview ?? avatarUrl);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="group relative rounded-full disabled:cursor-not-allowed"
        aria-label="Change avatar"
      >
        <Avatar name={name} avatarUrl={displayedUrl} className="h-20 w-20 text-2xl" />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-charcoal/0 text-off-white opacity-0 transition-opacity group-hover:bg-charcoal/50 group-hover:opacity-100 group-focus-visible:bg-charcoal/50 group-focus-visible:opacity-100">
          {pending ? (
            <LoaderCircle className="h-5 w-5 animate-spin" />
          ) : (
            <Camera className="h-5 w-5" />
          )}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        name="avatar"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />

      <span className="text-xs font-medium text-charcoal-light/70">
        {pending ? "Uploading…" : "Tap photo to change"}
      </span>

      {state.status === "error" && state.message && (
        <div
          role="alert"
          className="flex items-center gap-1.5 text-xs font-medium text-error"
        >
          <CircleAlert className="h-3.5 w-3.5 shrink-0" />
          {state.message}
        </div>
      )}
    </form>
  );
}
