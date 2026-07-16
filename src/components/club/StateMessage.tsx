import type { ComponentType } from "react";
import { CircleAlert } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  message,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-sand bg-off-white px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sand-light text-forest">
        <Icon className="h-6 w-6" />
      </span>
      <h2 className="text-base font-semibold text-charcoal">{title}</h2>
      <p className="max-w-sm text-sm text-charcoal-light/80">{message}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-2xl border border-error/30 bg-error-bg p-4 text-sm text-error"
    >
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
