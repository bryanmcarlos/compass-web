import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Flag } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { ErrorState } from "@/components/club/StateMessage";
import { ExamSubmissionForm, type ExamStatus, type BuddyOption } from "@/components/club/ExamSubmissionForm";

export default async function ExamsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Sign in to view your exam submissions.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_rank")
    .eq("id", user.id)
    .single();

  // Only a Rookie has R1/R2 to submit at all — a member who navigates here
  // directly at any other rank is silently sent back, same convention as a
  // non-marshal hitting a review-only tab.
  if (profile?.current_rank !== 2) {
    redirect("/profile");
  }

  const [{ data: submissions, error }, { data: memberRows }] = await Promise.all([
    supabase
      .from("exam_submissions")
      .select("exam_type, status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .overrideTypes<{ exam_type: "R1_CATCH_THE_FLAG" | "R2_MAZE"; status: ExamStatus }[], { merge: false }>(),
    supabase
      .from("profiles")
      .select("id, username, full_name")
      .eq("is_disabled", false)
      .neq("id", user.id)
      .order("username"),
  ]);

  const latestByType = new Map<string, ExamStatus>();
  for (const row of submissions ?? []) {
    if (!latestByType.has(row.exam_type)) {
      latestByType.set(row.exam_type, row.status);
    }
  }

  const buddyOptions: BuddyOption[] = (memberRows ?? []).map((m) => ({
    id: m.id,
    name: m.full_name ?? m.username,
  }));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/profile"
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-charcoal-light/70 hover:text-charcoal"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Profile
        </Link>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-forest">
            <Flag className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-charcoal">
            Rookie Challenges
          </h1>
        </div>
        <p className="text-sm text-charcoal-light/80">
          Pass both R1 and R2 to unlock the Intro to INT drive and finalize
          your promotion to Intermediate.
        </p>
      </header>

      {error ? (
        <ErrorState message="Couldn't load your exam submissions right now. Please try again shortly." />
      ) : (
        <div className="flex flex-col gap-4">
          <ExamSubmissionForm
            examType="R1_CATCH_THE_FLAG"
            title="R1: Catch the Flag"
            description="Buddy-system challenge — mention your buddy's name in your challenge post, then name them here."
            status={latestByType.get("R1_CATCH_THE_FLAG") ?? "not_submitted"}
            requiresBuddy
            buddyOptions={buddyOptions}
          />
          <ExamSubmissionForm
            examType="R2_MAZE"
            title="R2: Maze"
            description="Individual challenge."
            status={latestByType.get("R2_MAZE") ?? "not_submitted"}
            requiresBuddy={false}
            buddyOptions={[]}
          />
        </div>
      )}
    </div>
  );
}
