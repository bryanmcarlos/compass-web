"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, HourglassIcon, LoaderCircle, ShieldCheck } from "lucide-react";
import { Avatar } from "./Avatar";
import { verifyEquipmentItem, masterSignOffEquipment } from "@/app/(app)/equipment-review/actions";

export type ReviewEquipmentItem = {
  name: string;
  status: "pending" | "uploaded" | "verified";
  proofUrl: string | null;
};

export type EquipmentReviewMember = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  items: ReviewEquipmentItem[];
};

export function EquipmentReviewCard({ member }: { member: EquipmentReviewMember }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingItem, setPendingItem] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const verifiedCount = member.items.filter((i) => i.status === "verified").length;
  const submittedItems = member.items.filter((i) => i.status !== "pending");
  const canMasterSignOff = member.items.every((i) => i.status !== "pending");

  function handleVerify(itemName: string) {
    setPendingItem(itemName);
    setMessage(null);
    startTransition(async () => {
      const result = await verifyEquipmentItem(member.userId, itemName);
      setMessage(result.message);
      setPendingItem(null);
      router.refresh();
    });
  }

  function handleMasterSignOff() {
    setPendingItem(null);
    setMessage(null);
    startTransition(async () => {
      const result = await masterSignOffEquipment(member.userId);
      setMessage(result.message);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-sand bg-off-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={member.name} avatarUrl={member.avatarUrl} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-charcoal">{member.name}</span>
            <span className="text-xs text-charcoal-light/70">
              {verifiedCount}/{member.items.length} Verified
            </span>
          </div>
        </div>
        {canMasterSignOff && (
          <button
            type="button"
            disabled={isPending}
            onClick={handleMasterSignOff}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-off-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending && pendingItem === null ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            Approve All & Sign Off
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {submittedItems.map((item) => (
          <div
            key={item.name}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sand bg-sand-light/40 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              {item.proofUrl && (
                <a href={item.proofUrl} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary-hosted proof photo, no fixed remote domain to allowlist */}
                  <img
                    src={item.proofUrl}
                    alt={`Proof for ${item.name}`}
                    className="h-10 w-10 shrink-0 rounded-md border border-sand object-cover"
                  />
                </a>
              )}
              <span className="text-sm text-charcoal">{item.name}</span>
            </div>

            {item.status === "verified" ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-forest">
                <CircleCheck className="h-4 w-4" />
                Verified
              </span>
            ) : (
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleVerify(item.name)}
                className="flex items-center gap-1.5 rounded-lg border border-sand px-2.5 py-1.5 text-xs font-semibold text-charcoal transition-colors hover:border-forest/50 hover:text-forest disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isPending && pendingItem === item.name ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <HourglassIcon className="h-3.5 w-3.5" />
                )}
                Verify Item
              </button>
            )}
          </div>
        ))}
      </div>

      {message && <p className="text-xs text-charcoal-light/80">{message}</p>}
    </div>
  );
}
