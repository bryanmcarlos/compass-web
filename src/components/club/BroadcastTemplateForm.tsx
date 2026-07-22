"use client";

import { useActionState } from "react";
import { MessageSquareText, Save, LoaderCircle, CircleCheck, CircleAlert } from "lucide-react";
import {
  updateBroadcastTemplate,
  type BroadcastTemplateState,
} from "@/app/(app)/admin/site-settings/actions";
import { BROADCAST_TEMPLATE_TAGS } from "@/lib/broadcastTemplate";

const initialState: BroadcastTemplateState = { status: "idle", message: null };

export function BroadcastTemplateForm({ initialTemplate }: { initialTemplate: string }) {
  const [state, formAction, pending] = useActionState(updateBroadcastTemplate, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-2xl border border-sand bg-off-white p-6 shadow-sm sm:p-8"
    >
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
          <MessageSquareText className="h-4 w-4 text-forest" />
          Messaging Template — Drive Broadcast
        </h2>
        <p className="text-xs text-charcoal-light/70">
          Used by every Marshal&apos;s &quot;Broadcast Notice&quot; button on a drive&apos;s page
          to pre-fill a WhatsApp/Messenger share.
        </p>
      </div>

      <textarea
        name="broadcastMessageTemplate"
        defaultValue={initialTemplate}
        rows={12}
        className="w-full rounded-lg border border-sand bg-off-white px-3 py-2 font-mono text-sm text-charcoal focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
      />

      <div className="flex flex-col gap-2 rounded-lg bg-sand-light/50 p-3">
        <p className="text-xs font-semibold text-charcoal">Available placeholders</p>
        <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
          {BROADCAST_TEMPLATE_TAGS.map(({ tag, label }) => (
            <li key={tag} className="flex items-baseline gap-1.5 text-xs">
              <code className="shrink-0 rounded bg-off-white px-1.5 py-0.5 font-mono text-forest">
                {`{{${tag}}}`}
              </code>
              <span className="text-charcoal-light/70">{label}</span>
            </li>
          ))}
        </ul>
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
        className="flex w-fit items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-off-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {pending ? "Saving…" : "Save Template"}
      </button>
    </form>
  );
}
