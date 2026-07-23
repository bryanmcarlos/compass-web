"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Award, LoaderCircle } from "lucide-react";
import { Avatar } from "./Avatar";
import {
  promoteToMarshal,
  setMarshalshipAttestation,
  type MarshalshipAttestationField,
} from "@/app/(app)/promotions-review/actions";

export type MarshalPromotionReadyMember = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  approvedCount: number;
  requiredCount: number;
  trainingEndorsed: boolean;
  votePassed: boolean;
  finalAssessmentPassed: boolean;
};

const ATTESTATIONS: { field: MarshalshipAttestationField; label: string }[] = [
  { field: "marshalship_training_endorsed", label: "Marshalship Training — endorsed by Gen1 Marshals" },
  { field: "marshalship_vote_passed", label: "Marshals Vote — Council/Marshal vote approved" },
  { field: "marshalship_final_assessment_passed", label: "Marshalship NWB Drive — final assessment passed" },
];

/** The one "ready" card in this whole progression with no fully-automatic
 * finalize path — Marshal promotion is a real governance decision (a
 * training endorsement, a council vote, a final assessment run by actual
 * Marshals), not something this app can observe. These 3 checkboxes are a
 * Marshal's own attestation that each really happened, recorded here so
 * "Finalize" has something objective to require beyond the drive/must-skill
 * count — not the app inferring anything about a vote it never saw. */
export function MarshalPromotionReadyCard({ member }: { member: MarshalPromotionReadyMember }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [checkPending, setCheckPending] = useState<MarshalshipAttestationField | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const allChecked = member.trainingEndorsed && member.votePassed && member.finalAssessmentPassed;

  function handleToggle(field: MarshalshipAttestationField, checked: boolean) {
    setCheckPending(field);
    startTransition(async () => {
      await setMarshalshipAttestation(member.userId, field, checked);
      setCheckPending(null);
      router.refresh();
    });
  }

  function handleFinalize() {
    setMessage(null);
    startTransition(async () => {
      const result = await promoteToMarshal(member.userId);
      setMessage(result.message);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-sand bg-off-white p-5 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={member.name} avatarUrl={member.avatarUrl} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-semibold text-charcoal">{member.name}</span>
          <span className="text-xs text-charcoal-light/70">
            {member.approvedCount}/{member.requiredCount} Supervised Leads · Must Skills ✓
          </span>
        </div>
      </div>

      <ul className="flex flex-col gap-1.5 border-t border-sand pt-3">
        {ATTESTATIONS.map(({ field, label }) => {
          const checked =
            field === "marshalship_training_endorsed"
              ? member.trainingEndorsed
              : field === "marshalship_vote_passed"
                ? member.votePassed
                : member.finalAssessmentPassed;
          return (
            <label
              key={field}
              className="flex items-center gap-2.5 rounded-lg border border-sand px-3 py-2 text-sm text-charcoal has-[:checked]:border-forest has-[:checked]:bg-forest/5"
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={isPending}
                onChange={(e) => handleToggle(field, e.target.checked)}
                className="h-4 w-4 shrink-0 rounded border-sand text-forest focus:ring-2 focus:ring-forest/20"
              />
              {label}
              {checkPending === field && <LoaderCircle className="ml-auto h-3.5 w-3.5 animate-spin" />}
            </label>
          );
        })}
      </ul>

      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          disabled={isPending || !allChecked}
          onClick={handleFinalize}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-off-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Award className="h-3.5 w-3.5" />}
          Finalize Promotion to Marshal
        </button>
        {message && <p className="text-xs text-charcoal-light/80">{message}</p>}
      </div>
    </div>
  );
}
