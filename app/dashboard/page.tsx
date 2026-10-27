import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { createClient } from "@/lib/supabase/server";
import type { Profile, PublicReport } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, student_id, is_admin")
    .eq("id", user.id)
    .single();
  if (profileError || !profileData) {
    console.error("Unable to load the signed-in profile", profileError);
    redirect("/login");
  }
  const profile = profileData as Profile;
  const { data: ownedReports, error: ownedReportsError } = await supabase.from("reports").select("*")
    .eq("user_id", user.id).order("created_at", { ascending: false });
  if (ownedReportsError) {
    console.error("Unable to load owned reports", ownedReportsError);
    throw new Error("Your reports are temporarily unavailable.");
  }
  const { data: notifications, error: notificationsError } = await supabase.from("notifications")
    .select("id, report_id, message, created_at, read_at").eq("user_id", user.id)
    .order("created_at", { ascending: false }).limit(8);
  if (notificationsError) {
    console.error("Unable to load notifications", notificationsError);
    throw new Error("Notifications are temporarily unavailable.");
  }
  const { data, error } = await supabase.from("public_reports").select("*")
    .order("created_at", { ascending: false }).range(0, 11);
  if (error) {
    console.error("Unable to load the public reports feed", error);
    throw new Error("The reports board is temporarily unavailable.");
  }
  return <Dashboard profile={profile} initialReports={(data ?? []) as PublicReport[]} initialOwnedReports={ownedReports ?? []} notifications={notifications ?? []} />;
}
