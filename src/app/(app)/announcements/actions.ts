"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import type { ToggleReactionState } from "@/components/club/LikeButton";

export async function toggleAnnouncementReaction(announcementId: string): Promise<ToggleReactionState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { status: "error", liked: false, message: "You need to be signed in to like this." };
  }

  const { data: existing } = await supabase
    .from("announcement_reactions")
    .select("id")
    .eq("announcement_id", announcementId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("announcement_reactions").delete().eq("id", existing.id);
    if (error) {
      console.error("SERVER ACTION ERROR [toggleAnnouncementReaction]:", error);
      return { status: "error", liked: true, message: "Couldn't unlike this. Please try again." };
    }
    revalidatePath("/");
    return { status: "success", liked: false };
  }

  const { error } = await supabase
    .from("announcement_reactions")
    .insert({ announcement_id: announcementId, user_id: user.id, reaction_type: "like" });
  if (error) {
    console.error("SERVER ACTION ERROR [toggleAnnouncementReaction]:", error);
    return { status: "error", liked: false, message: "Couldn't like this. Please try again." };
  }
  revalidatePath("/");
  return { status: "success", liked: true };
}
