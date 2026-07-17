"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import {
  Search,
  Settings2,
  Ban,
  CircleCheck,
  CircleAlert,
  KeyRound,
  LoaderCircle,
  Save,
} from "lucide-react";
import { Avatar } from "./Avatar";
import { RankBadge } from "./RankBadge";
import { CLUB_CONFIG } from "@/lib/constants";
import {
  updateMemberRank,
  toggleMemberDisabled,
  updateMemberFields,
  type MemberActionState,
} from "@/app/(app)/admin/members/actions";

export type Member = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  current_rank: number;
  is_marshal: boolean;
  is_mit: boolean;
  is_disabled: boolean;
  mobile_number: string | null;
  car_details: string | null;
};

type StatusMessageValue = { type: "error" | "success"; text: string } | null;

const initialFieldsState: MemberActionState = { status: "idle", message: null };

export function MembersTable({
  members,
  currentUserId,
}: {
  members: Member[];
  currentUserId: string;
}) {
  const [query, setQuery] = useState("");
  const [rankFilter, setRankFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      const matchesQuery =
        !q ||
        m.username.toLowerCase().includes(q) ||
        (m.full_name ?? "").toLowerCase().includes(q);
      const matchesRank = rankFilter === "all" || m.current_rank === Number(rankFilter);
      return matchesQuery && matchesRank;
    });
  }, [members, query, rankFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-charcoal-light/60" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username or name…"
            className="w-full rounded-lg border border-sand bg-off-white py-2 pr-3 pl-9 text-base text-charcoal placeholder:text-charcoal-light/40 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
          />
        </div>
        <select
          value={rankFilter}
          onChange={(e) => setRankFilter(e.target.value)}
          className="w-full rounded-lg border border-sand bg-off-white px-3 py-2 text-base text-charcoal focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none sm:w-48"
        >
          <option value="all">All ranks</option>
          {CLUB_CONFIG.ranks.map((r) => (
            <option key={r.level} value={r.level}>
              {r.title}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-sand bg-off-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-sand text-xs font-semibold tracking-wide text-charcoal-light/70 uppercase">
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-charcoal-light/60">
                  No members match your search.
                </td>
              </tr>
            ) : (
              filtered.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  isExpanded={expandedId === member.id}
                  isSelf={member.id === currentUserId}
                  onToggleExpand={() =>
                    setExpandedId((prev) => (prev === member.id ? null : member.id))
                  }
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MemberRow({
  member,
  isExpanded,
  isSelf,
  onToggleExpand,
}: {
  member: Member;
  isExpanded: boolean;
  isSelf: boolean;
  onToggleExpand: () => void;
}) {
  const displayName = member.full_name ?? member.username;

  return (
    <>
      <tr className="border-b border-sand last:border-b-0">
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Avatar name={displayName} avatarUrl={member.avatar_url} className="h-9 w-9 text-xs" />
            <div className="min-w-0">
              <p className="truncate font-medium text-charcoal">
                {displayName}
                {isSelf && <span className="ml-1.5 text-xs text-charcoal-light/50">(you)</span>}
              </p>
              <p className="truncate text-xs text-charcoal-light/60">@{member.username}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <RankBadge rank={member.current_rank} />
        </td>
        <td className="px-4 py-3">
          {member.is_disabled ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-error-bg px-2 py-0.5 text-xs font-semibold text-error">
              <Ban className="h-3 w-3" />
              Disabled
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-forest/10 px-2 py-0.5 text-xs font-semibold text-forest-dark">
              <CircleCheck className="h-3 w-3" />
              Active
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <button
            type="button"
            onClick={onToggleExpand}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sand px-3 py-1.5 text-xs font-semibold text-charcoal-light transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {isExpanded ? "Close" : "Manage"}
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-sand bg-sand-light/60">
          <td colSpan={4} className="px-4 py-5">
            <div className="flex flex-col gap-6">
              <RankControl member={member} />
              <DisableControl member={member} isSelf={isSelf} />
              <PasswordResetControl member={member} />
              <FieldsEditControl member={member} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function StatusMessage({ message }: { message: StatusMessageValue }) {
  if (!message) return null;
  return (
    <p
      className={`flex items-center gap-1.5 text-xs ${
        message.type === "error" ? "text-error" : "text-forest-dark"
      }`}
    >
      {message.type === "error" ? (
        <CircleAlert className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <CircleCheck className="h-3.5 w-3.5 shrink-0" />
      )}
      {message.text}
    </p>
  );
}

function RankControl({ member }: { member: Member }) {
  const [rank, setRank] = useState(member.current_rank);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<StatusMessageValue>(null);

  function handleApply() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateMemberRank(member.id, rank);
      setMessage({
        type: result.status === "error" ? "error" : "success",
        text: result.message ?? "",
      });
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-charcoal-light/70 uppercase">
        Rank Override
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={rank}
          onChange={(e) => setRank(Number(e.target.value))}
          className="rounded-lg border border-sand bg-off-white px-3 py-2 text-base text-charcoal focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
        >
          {CLUB_CONFIG.ranks.map((r) => (
            <option key={r.level} value={r.level}>
              {r.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleApply}
          disabled={isPending || rank === member.current_rank}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-off-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Apply
        </button>
      </div>
      <StatusMessage message={message} />
    </div>
  );
}

function DisableControl({ member, isSelf }: { member: Member; isSelf: boolean }) {
  const [isDisabled, setIsDisabled] = useState(member.is_disabled);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<StatusMessageValue>(null);

  function handleToggle() {
    const next = !isDisabled;
    setMessage(null);
    startTransition(async () => {
      const result = await toggleMemberDisabled(member.id, next);
      if (result.status === "error") {
        setMessage({ type: "error", text: result.message ?? "" });
        return;
      }
      setIsDisabled(next);
      setMessage({ type: "success", text: result.message ?? "" });
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-charcoal-light/70 uppercase">
        Account Access
      </h3>
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending || isSelf}
        title={isSelf ? "You can't disable your own account" : undefined}
        className={`flex w-fit items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          isDisabled
            ? "border-forest/40 bg-off-white text-forest hover:bg-forest/10"
            : "border-error/30 bg-off-white text-error hover:bg-error-bg"
        }`}
      >
        {isPending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : isDisabled ? (
          <CircleCheck className="h-4 w-4" />
        ) : (
          <Ban className="h-4 w-4" />
        )}
        {isDisabled ? "Re-enable Account" : "Disable Account"}
      </button>
      <StatusMessage message={message} />
    </div>
  );
}

function PasswordResetControl({ member }: { member: Member }) {
  const [newPassword, setNewPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<StatusMessageValue>(null);

  async function handleReset() {
    if (newPassword.length < 8) {
      setMessage({ type: "error", text: "New password must be at least 8 characters." });
      return;
    }
    setIsPending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: member.id,
          action: "resetPassword",
          data: { newPassword },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Couldn't reset password.");
      }
      setMessage({ type: "success", text: json.message ?? "Password reset." });
      setNewPassword("");
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Couldn't reset password.",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-charcoal-light/70 uppercase">
        Reset Password
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <KeyRound className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-charcoal-light/60" />
          <input
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min. 8 characters)"
            className="w-64 rounded-lg border border-sand bg-off-white py-2 pr-3 pl-9 text-base text-charcoal placeholder:text-charcoal-light/40 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={handleReset}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-off-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <KeyRound className="h-4 w-4" />
          )}
          Reset
        </button>
      </div>
      <StatusMessage message={message} />
    </div>
  );
}

function FieldsEditControl({ member }: { member: Member }) {
  const [state, formAction, pending] = useActionState(updateMemberFields, initialFieldsState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-charcoal-light/70 uppercase">
        Profile Fields
      </h3>
      <input type="hidden" name="memberId" value={member.id} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input
          type="text"
          name="fullName"
          defaultValue={member.full_name ?? ""}
          placeholder="Full name"
          className="rounded-lg border border-sand bg-off-white px-3 py-2 text-base text-charcoal placeholder:text-charcoal-light/40 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
        />
        <input
          type="tel"
          name="mobileNumber"
          defaultValue={member.mobile_number ?? ""}
          placeholder="+9715XXXXXXXX"
          className="rounded-lg border border-sand bg-off-white px-3 py-2 text-base text-charcoal placeholder:text-charcoal-light/40 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
        />
        <input
          type="text"
          name="carDetails"
          defaultValue={member.car_details ?? ""}
          placeholder="Car details"
          className="rounded-lg border border-sand bg-off-white px-3 py-2 text-base text-charcoal placeholder:text-charcoal-light/40 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="flex w-fit items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-off-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Save Fields
      </button>
      {state.status !== "idle" && state.message && (
        <StatusMessage
          message={{ type: state.status === "error" ? "error" : "success", text: state.message }}
        />
      )}
    </form>
  );
}
