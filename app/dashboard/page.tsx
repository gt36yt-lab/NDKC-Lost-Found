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
    .select("id, full_name, student_id")
    .eq("id", user.id)
    .single();
  if (profileError || !profileData) {
    console.error("Unable to load the signed-in profile", profileError);
    redirect("/login");
  }
  const profile = profileData as Profile;
  const { data, error } = await supabase.from("public_reports").select("*")
    .order("created_at", { ascending: false }).range(0, 11);
  if (error) {
    console.error("Unable to load the public reports feed", error);
    throw new Error("The reports board is temporarily unavailable.");
  }
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: updatesCount, error: updatesError } = await supabase
    .from("public_reports")
    .select("id", { count: "exact", head: true })
    .gte("created_at", weekAgo);
  if (updatesError) {
    console.error("Unable to load the report update count", updatesError);
    throw new Error("The reports board is temporarily unavailable.");
  }

  return <Dashboard profile={profile} initialReports={(data ?? []) as PublicReport[]} updatesCount={updatesCount ?? 0} />;
}
