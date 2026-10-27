"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ChevronDown, LoaderCircle, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, PublicReport } from "@/lib/types";

const PAGE_SIZE = 20;
const statuses = ["pending", "approved", "claimed", "resolved", "rejected"] as const;
type AdminReport = PublicReport & { user_id: string; full_name: string; student_id: string; email: string };

function photoPath(url: string | null) {
  if (!url) return null;
  const marker = "/storage/v1/object/public/item-photos/";
  const index = url.indexOf(marker);
  return index < 0 ? null : decodeURIComponent(url.slice(index + marker.length));
}

export function AdminDashboard({ initialReports, initialUsers, totalReports, completedReports, totalUsers }: {
  initialReports: AdminReport[];
  initialUsers: Profile[];
  totalReports: number;
  completedReports: number;
  totalUsers: number;
}) {
  const [reports, setReports] = useState(initialReports);
  const [users, setUsers] = useState(initialUsers);
  const [reportHasMore, setReportHasMore] = useState(initialReports.length === PAGE_SIZE);
  const [userHasMore, setUserHasMore] = useState(initialUsers.length === PAGE_SIZE);
  const [loadingReports, setLoadingReports] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminReport | null>(null);
  const [error, setError] = useState("");

  async function loadReports() {
    setLoadingReports(true);
    const { data, error: queryError } = await createClient().from("reports").select("*")
      .order("created_at", { ascending: false }).range(reports.length, reports.length + PAGE_SIZE - 1);
    if (queryError) {
      setError("Unable to load more reports.");
      console.error("Unable to load admin reports", queryError);
    } else {
      const next = (data ?? []) as AdminReport[];
      setReports((current) => [...current, ...next]);
      setReportHasMore(next.length === PAGE_SIZE);
    }
    setLoadingReports(false);
  }

  async function loadUsers() {
    setLoadingUsers(true);
    const { data, error: queryError } = await createClient().from("profiles")
      .select("id, full_name, student_id, email, course_dept, created_at")
      .order("created_at", { ascending: false }).range(users.length, users.length + PAGE_SIZE - 1);
    if (queryError) {
      setError("Unable to load more users.");
      console.error("Unable to load admin users", queryError);
    } else {
      const next = (data ?? []) as Profile[];
      setUsers((current) => [...current, ...next]);
      setUserHasMore(next.length === PAGE_SIZE);
    }
    setLoadingUsers(false);
  }

  async function updateStatus(report: AdminReport, status: string) {
    setBusyId(report.id);
    setError("");
    const { error: updateError } = await createClient().from("reports").update({ status }).eq("id", report.id);
    if (updateError) {
      setError(`Unable to update ${report.item_name}.`);
      console.error("Unable to update admin report", updateError);
    } else {
      setReports((current) => current.map((item) => item.id === report.id ? { ...item, status } : item));
    }
    setBusyId("");
  }

  async function deleteReport() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("reports").delete().eq("id", deleteTarget.id);
    if (deleteError) {
      setError(`Unable to delete ${deleteTarget.item_name}.`);
      console.error("Unable to delete admin report", deleteError);
    } else {
      setReports((current) => current.filter((item) => item.id !== deleteTarget.id));
      const path = photoPath(deleteTarget.image_url);
      if (path) {
        const { error: photoError } = await supabase.storage.from("item-photos").remove([path]);
        if (photoError) console.error("Unable to remove the deleted report photo", photoError);
      }
      setDeleteTarget(null);
    }
    setBusyId("");
  }

  return (
    <main className="min-h-screen bg-ndkc-cream">
      <header className="bg-ndkc-green text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3"><Image src="/Logo.jpg" alt="NDKC seal" width={44} height={44} className="h-11 w-11 rounded-full bg-white object-contain p-0.5" /><div><p className="text-xs font-bold uppercase tracking-widest text-ndkc-gold">Notre Dame of Kidapawan College</p><p className="text-sm font-semibold">Lost &amp; Found Administration</p></div></div>
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-white/10"><ArrowLeft size={17} /> Community board</Link>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-8 sm:py-10">
        <div className="mb-7"><p className="text-xs font-bold uppercase tracking-[0.18em] text-ndkc-emerald">Administration</p><h1 className="mt-1 text-3xl font-extrabold">Dashboard</h1></div>
        <section aria-label="System statistics" className="mb-10 grid gap-3 sm:grid-cols-3">
          <Stat label="Total reports" value={totalReports} />
          <Stat label="Claimed or resolved" value={completedReports} />
          <Stat label="Registered students" value={totalUsers} />
        </section>
        {error && <p role="alert" className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <section className="mb-12">
          <div className="mb-4 flex items-end justify-between gap-4"><div><h2 className="text-xl font-extrabold">Reports</h2><p className="mt-1 text-sm text-stone-600">{totalReports} submitted reports</p></div></div>
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500"><tr><th className="px-4 py-3">Item</th><th className="px-4 py-3">Reporter</th><th className="px-4 py-3">Type / Date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead>
              <tbody className="divide-y divide-stone-100">
                {reports.map((report) => <tr key={report.id}>
                  <td className="px-4 py-3"><p className="font-bold text-stone-900">{report.item_name}</p><p className="mt-0.5 text-xs text-stone-500">{report.category} · {report.building_area}</p></td>
                  <td className="px-4 py-3"><p className="font-semibold">{report.full_name}</p><p className="text-xs text-stone-500">{report.student_id} · {report.email || "No email"}</p></td>
                  <td className="px-4 py-3"><p className="capitalize">{report.report_type}</p><p className="text-xs text-stone-500">{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(report.created_at))}</p></td>
                  <td className="px-4 py-3"><label className="relative inline-flex items-center"><select aria-label={`Status for ${report.item_name}`} value={report.status} disabled={busyId === report.id} onChange={(event) => updateStatus(report, event.target.value)} className="w-36 appearance-none rounded-md border border-stone-300 bg-white py-2 pl-3 pr-8 text-sm capitalize disabled:opacity-60">{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>{busyId === report.id ? <LoaderCircle size={14} className="absolute right-2 animate-spin" /> : <ChevronDown size={14} className="pointer-events-none absolute right-2 text-stone-500" />}</label></td>
                  <td className="px-4 py-3"><button disabled={busyId === report.id} onClick={() => setDeleteTarget(report)} aria-label={`Delete ${report.item_name}`} className="rounded-md p-2 text-red-700 hover:bg-red-50 disabled:opacity-60"><Trash2 size={17} /></button></td>
                </tr>)}
                {reports.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-stone-500">No reports have been submitted.</td></tr>}
              </tbody>
            </table>
          </div>
          {reportHasMore && <div className="mt-3 text-right"><button disabled={loadingReports} onClick={loadReports} className="rounded-lg border border-ndkc-emerald px-4 py-2 text-sm font-bold text-ndkc-emerald hover:bg-emerald-50 disabled:opacity-60">{loadingReports ? "Loading…" : "Load more reports"}</button></div>}
        </section>
        <section>
          <div className="mb-4"><h2 className="text-xl font-extrabold">Registered students</h2><p className="mt-1 text-sm text-stone-600">{totalUsers} registered accounts</p></div>
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500"><tr><th className="px-4 py-3">Full name</th><th className="px-4 py-3">Student ID</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Course / Dept</th><th className="px-4 py-3">Registration date</th></tr></thead>
              <tbody className="divide-y divide-stone-100">
                {users.map((user) => <tr key={user.id}><td className="px-4 py-3 font-semibold">{user.full_name}</td><td className="px-4 py-3">{user.student_id}</td><td className="px-4 py-3">{user.email || "—"}</td><td className="px-4 py-3">{user.course_dept || "—"}</td><td className="px-4 py-3">{user.created_at ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(user.created_at)) : "—"}</td></tr>)}
                {users.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-stone-500">No registered students found.</td></tr>}
              </tbody>
            </table>
          </div>
          {userHasMore && <div className="mt-3 text-right"><button disabled={loadingUsers} onClick={loadUsers} className="rounded-lg border border-ndkc-emerald px-4 py-2 text-sm font-bold text-ndkc-emerald hover:bg-emerald-50 disabled:opacity-60">{loadingUsers ? "Loading…" : "Load more students"}</button></div>}
        </section>
      </div>
      {deleteTarget && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"><section role="dialog" aria-modal="true" aria-labelledby="admin-delete-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"><h2 id="admin-delete-title" className="text-lg font-extrabold">Permanently delete report?</h2><p className="mt-2 text-sm text-stone-600">This will remove “{deleteTarget.item_name}” from the system.</p>{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}<div className="mt-6 flex justify-end gap-2"><button disabled={busyId === deleteTarget.id} onClick={() => setDeleteTarget(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold">Cancel</button><button disabled={busyId === deleteTarget.id} onClick={deleteReport} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Delete report</button></div></section></div>}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <article className="rounded-lg border border-stone-200 bg-white px-5 py-4"><p className="text-sm font-semibold text-stone-600">{label}</p><p className="mt-2 text-3xl font-extrabold text-ndkc-green">{value.toLocaleString("en-PH")}</p></article>;
}