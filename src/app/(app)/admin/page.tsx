import { redirect } from "next/navigation";

/** The auth guard lives in admin/layout.tsx, which wraps this route too —
 * this segment exists only to send /admin somewhere concrete. */
export default function AdminIndexPage() {
  redirect("/admin/site-settings");
}
