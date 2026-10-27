"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ChevronDown, LoaderCircle, Pencil, ShieldCheck, Trash2, UserRoundPen } from "lucide-react";
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

export function AdminDashboard({ currentAdminId, initialReports, initialUsers, totalReports, completedReports, totalUsers }: {
  currentAdminId: string;
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
  const [editingReport, setEditingReport] = useState<AdminReport | null>(null);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [deletingUser, setDeletingUser] = useState<Profile | null>(null);
  const [userFormError, setUserFormError] = useState("");
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
      .select("id, full_name, student_id, email, course_dept, is_admin, created_at")
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

  async function saveReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingReport) return;
    const formData = new FormData(event.currentTarget);
    const changes = {
      item_name: String(formData.get("item_name") ?? "").trim(),
      category: String(formData.get("category") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      event_date: String(formData.get("event_date") ?? ""),
      building_area: String(formData.get("building_area") ?? "").trim(),
      specific_location: String(formData.get("specific_location") ?? "").trim(),
    };
    setBusyId(editingReport.id);
    setError("");
    const { error: updateError } = await createClient().from("reports").update(changes).eq("id", editingReport.id);
    if (updateError) {
      setError("Unable to save report changes.");
      console.error("Unable to edit admin report", updateError);
    } else {
      setReports((current) => current.map((item) => item.id === editingReport.id ? { ...item, ...changes } : item));
      setEditingReport(null);
    }
    setBusyId("");
  }

  async function saveUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser) return;
    const formData = new FormData(event.currentTarget);
    setBusyId(editingUser.id);
    setUserFormError("");
    try {
      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: formData.get("full_name"),
          student_id: formData.get("student_id"),
          email: formData.get("email"),
          course_dept: formData.get("course_dept"),
          is_admin: editingUser.id === currentAdminId ? Boolean(editingUser.is_admin) : formData.get("is_admin") === "on",
        }),
      });
      const result = await response.json() as { error?: string; profile?: Profile };
      if (!response.ok || !result.profile) throw new Error(result.error ?? "Unable to save account changes.");
      setUsers((current) => current.map((item) => item.id === editingUser.id ? { ...item, ...result.profile } : item));
      setEditingUser(null);
    } catch (cause) {
      setUserFormError(cause instanceof Error ? cause.message : "Unable to save account changes.");
    }
    setBusyId("");
  }

  async function deleteUser() {
    if (!deletingUser) return;
    setBusyId(deletingUser.id);
    setUserFormError("");
    try {
      const response = await fetch(`/api/admin/users/${deletingUser.id}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to delete account.");
      setUsers((current) => current.filter((item) => item.id !== deletingUser.id));
      setDeletingUser(null);
    } catch (cause) {
      setUserFormError(cause instanceof Error ? cause.message : "Unable to delete account.");
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
                  <td className="px-4 py-3"><div className="flex items-center gap-1"><button disabled={busyId === report.id} onClick={() => setEditingReport(report)} aria-label={`Edit ${report.item_name}`} title="Edit report" className="rounded-md p-2 text-ndkc-emerald hover:bg-emerald-50 disabled:opacity-60"><Pencil size={16} /></button><button disabled={busyId === report.id} onClick={() => setDeleteTarget(report)} aria-label={`Delete ${report.item_name}`} title="Delete report" className="rounded-md p-2 text-red-700 hover:bg-red-50 disabled:opacity-60"><Trash2 size={17} /></button></div></td>
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
              <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500"><tr><th className="px-4 py-3">Full name</th><th className="px-4 py-3">Student ID</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Course / Dept</th><th className="px-4 py-3">Access</th><th className="px-4 py-3">Actions</th></tr></thead>
              <tbody className="divide-y divide-stone-100">
                {users.map((user) => <tr key={user.id}><td className="px-4 py-3 font-semibold">{user.full_name}</td><td className="px-4 py-3">{user.student_id}</td><td className="px-4 py-3">{user.email || "—"}</td><td className="px-4 py-3">{user.course_dept || "—"}</td><td className="px-4 py-3">{user.is_admin ? <span className="inline-flex items-center gap-1 text-xs font-bold text-ndkc-emerald"><ShieldCheck size={15} /> Admin</span> : <span className="text-xs text-stone-500">Student</span>}</td><td className="px-4 py-3"><div className="flex items-center gap-1"><button onClick={() => { setEditingUser(user); setUserFormError(""); }} aria-label={`Edit ${user.full_name}`} title="Edit account" className="rounded-md p-2 text-ndkc-emerald hover:bg-emerald-50"><UserRoundPen size={17} /></button><button disabled={user.id === currentAdminId || busyId === user.id} onClick={() => { setDeletingUser(user); setUserFormError(""); }} aria-label={`Delete ${user.full_name}`} title={user.id === currentAdminId ? "You cannot delete your active account" : "Delete account"} className="rounded-md p-2 text-red-700 hover:bg-red-50 disabled:opacity-60"><Trash2 size={17} /></button></div></td></tr>)}
                {users.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-stone-500">No registered students found.</td></tr>}
              </tbody>
            </table>
          </div>
          {userHasMore && <div className="mt-3 text-right"><button disabled={loadingUsers} onClick={loadUsers} className="rounded-lg border border-ndkc-emerald px-4 py-2 text-sm font-bold text-ndkc-emerald hover:bg-emerald-50 disabled:opacity-60">{loadingUsers ? "Loading…" : "Load more students"}</button></div>}
        </section>
      </div>
      {deleteTarget && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"><section role="dialog" aria-modal="true" aria-labelledby="admin-delete-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"><h2 id="admin-delete-title" className="text-lg font-extrabold">Permanently delete report?</h2><p className="mt-2 text-sm text-stone-600">This will remove “{deleteTarget.item_name}” from the system.</p>{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}<div className="mt-6 flex justify-end gap-2"><button disabled={busyId === deleteTarget.id} onClick={() => setDeleteTarget(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold">Cancel</button><button disabled={busyId === deleteTarget.id} onClick={deleteReport} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Delete report</button></div></section></div>}
      {editingReport && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 p-4"><form onSubmit={saveReport} className="my-6 w-full max-w-xl rounded-xl bg-white p-6 shadow-2xl"><h2 className="text-lg font-extrabold">Edit report</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Item name" name="item_name" defaultValue={editingReport.item_name} required /><Field label="Category" name="category" defaultValue={editingReport.category} required /><Field label="Date" name="event_date" type="date" defaultValue={editingReport.event_date} required /><Field label="Building / Area" name="building_area" defaultValue={editingReport.building_area} required /><Field label="Specific location" name="specific_location" defaultValue={editingReport.specific_location ?? ""} /><label className="block sm:col-span-2"><span className="form-label">Description</span><textarea name="description" defaultValue={editingReport.description} maxLength={2000} required className="field min-h-28" /></label></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setEditingReport(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold">Cancel</button><button disabled={busyId === editingReport.id} className="rounded-lg bg-ndkc-emerald px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{busyId === editingReport.id ? "Saving…" : "Save report"}</button></div></form></div>}
      {editingUser && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 p-4"><form onSubmit={saveUser} className="my-6 w-full max-w-xl rounded-xl bg-white p-6 shadow-2xl"><h2 className="text-lg font-extrabold">Edit account</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Full name" name="full_name" defaultValue={editingUser.full_name} required /><Field label="Student ID" name="student_id" defaultValue={editingUser.student_id} required /><Field label="Email" name="email" type="email" defaultValue={editingUser.email ?? ""} /><Field label="Course / Department" name="course_dept" defaultValue={editingUser.course_dept ?? ""} /><label className="flex items-center gap-3 rounded-lg border border-stone-200 px-3 py-3 text-sm font-semibold sm:col-span-2"><input type="checkbox" name="is_admin" defaultChecked={editingUser.is_admin} disabled={editingUser.id === currentAdminId} className="h-4 w-4 accent-ndkc-emerald" />Administrator access{editingUser.id === currentAdminId && <span className="text-xs font-normal text-stone-500">(cannot remove your own access)</span>}</label></div>{userFormError && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{userFormError}</p>}<div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setEditingUser(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold">Cancel</button><button disabled={busyId === editingUser.id} className="rounded-lg bg-ndkc-emerald px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{busyId === editingUser.id ? "Saving…" : "Save account"}</button></div></form></div>}
      {deletingUser && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"><section role="dialog" aria-modal="true" aria-labelledby="delete-user-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"><h2 id="delete-user-title" className="text-lg font-extrabold">Delete this account?</h2><p className="mt-2 text-sm text-stone-600">This permanently removes {deletingUser.full_name}’s sign-in and profile. Their submitted reports will also be deleted.</p>{userFormError && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{userFormError}</p>}<div className="mt-6 flex justify-end gap-2"><button disabled={busyId === deletingUser.id} onClick={() => setDeletingUser(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold">Cancel</button><button disabled={busyId === deletingUser.id} onClick={deleteUser} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{busyId === deletingUser.id ? "Deleting…" : "Delete account"}</button></div></section></div>}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <article className="rounded-lg border border-stone-200 bg-white px-5 py-4"><p className="text-sm font-semibold text-stone-600">{label}</p><p className="mt-2 text-3xl font-extrabold text-ndkc-green">{value.toLocaleString("en-PH")}</p></article>;
}

function Field({ label, name, defaultValue, type = "text", required = false }: { label: string; name: string; defaultValue: string; type?: string; required?: boolean }) {
  return <label className="block"><span className="form-label">{label}</span><input className="field" name={name} defaultValue={defaultValue} type={type} required={required} maxLength={type === "text" ? 200 : undefined} /></label>;
}