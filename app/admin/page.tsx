import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { createClient } from "@/lib/supabase/server";
import type { Profile, PublicReport } from "@/lib/types";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("id, is_admin").eq("id", user.id).single();
  if (profileError || !profile?.is_admin) redirect("/dashboard");

  const [reportsResult, usersResult, totalReportsResult, completedReportsResult, totalUsersResult] = await Promise.all([
    supabase.from("reports").select("*").order("created_at", { ascending: false }).range(0, PAGE_SIZE - 1),
    supabase.from("profiles").select("id, full_name, student_id, email, course_dept, created_at").order("created_at", { ascending: false }).range(0, PAGE_SIZE - 1),
    supabase.from("reports").select("id", { count: "exact", head: true }),
    supabase.from("reports").select("id", { count: "exact", head: true }).in("status", ["claimed", "resolved"]),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
  ]);

  const queryError = reportsResult.error ?? usersResult.error ?? totalReportsResult.error ?? completedReportsResult.error ?? totalUsersResult.error;
  if (queryError) {
    console.error("Unable to load admin dashboard", queryError);
    throw new Error("The administration dashboard is temporarily unavailable.");
  }

  return <AdminDashboard
    initialReports={(reportsResult.data ?? []) as (PublicReport & { user_id: string; full_name: string; student_id: string; email: string })[]}
    initialUsers={(usersResult.data ?? []) as Profile[]}
    totalReports={totalReportsResult.count ?? 0}
    completedReports={completedReportsResult.count ?? 0}
    totalUsers={totalUsersResult.count ?? 0}
  />;
}