import { redirect } from "next/navigation";
import { ReportForm } from "@/components/report-form";
import { Brand } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ReportPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, student_id")
    .eq("id", user.id)
    .single();
  if (profileError || !profile) {
    console.error("Unable to load the reporter profile", profileError);
    redirect("/login");
  }
  return (
    <main className="min-h-screen bg-ndkc-cream">
      <header className="bg-ndkc-green px-5 py-4"><div className="mx-auto max-w-3xl"><Brand /></div></header>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="rounded-2xl bg-white p-5 shadow-soft sm:p-9">
        <ReportForm reporter={{
          id: user.id,
          full_name: profile.full_name,
          student_id: profile.student_id,
          email: String(user.user_metadata.contact_email ?? ""),
        }} />
        </div>
      </div>
    </main>
  );
}
