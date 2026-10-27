"use client";

import Image from "next/image";
import { useState } from "react";
import { Check, LoaderCircle, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { OwnedReport } from "@/lib/types";

function photoPath(url: string | null) {
  if (!url) return null;
  const marker = "/storage/v1/object/public/item-photos/";
  const index = url.indexOf(marker);
  return index < 0 ? null : decodeURIComponent(url.slice(index + marker.length));
}

export function OwnerReportManagement({ initialReports }: { initialReports: OwnedReport[] }) {
  const [reports, setReports] = useState(initialReports);
  const [deleting, setDeleting] = useState<OwnedReport | null>(null);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function changeStatus(report: OwnedReport) {
    const status = report.status === "claimed" ? "resolved" : "claimed";
    setBusyId(report.id);
    setError("");
    const { error: updateError } = await createClient().from("reports").update({ status }).eq("id", report.id);
    if (updateError) {
      setError("The report status could not be updated. Please try again.");
      console.error("Unable to update owned report status", updateError);
    } else {
      setReports((current) => current.map((item) => item.id === report.id ? { ...item, status, updated_at: new Date().toISOString() } : item));
    }
    setBusyId("");
  }

  async function deleteReport() {
    if (!deleting) return;
    setBusyId(deleting.id);
    setError("");
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("reports").delete().eq("id", deleting.id);
    if (deleteError) {
      setError("The report could not be deleted. Please try again.");
      console.error("Unable to delete owned report", deleteError);
    } else {
      setReports((current) => current.filter((item) => item.id !== deleting.id));
      const path = photoPath(deleting.image_url);
      if (path) {
        const { error: photoError } = await supabase.storage.from("item-photos").remove([path]);
        if (photoError) console.error("Unable to remove the deleted report photo", photoError);
      }
      setDeleting(null);
    }
    setBusyId("");
  }

  return (
    <section className="mt-12 border-t border-stone-200 pt-9">
      <div className="mb-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-ndkc-emerald">Your activity</p><h2 className="mt-1 text-2xl font-extrabold">My reports</h2></div>
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {reports.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white px-5 py-8 text-sm text-stone-500">Your submitted reports will appear here.</p>
      ) : (
        <div className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
          {reports.map((report) => (
            <article key={report.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                {report.image_url ? <Image src={report.image_url} alt={report.item_name} fill sizes="96px" unoptimized className="object-cover" /> : <div className="grid h-full place-items-center text-xs text-stone-400">No photo</div>}
              </div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-stone-900">{report.item_name}</h3><span className="rounded-md bg-stone-100 px-2 py-1 text-xs capitalize text-stone-600">{report.status}</span></div><p className="mt-1 text-sm text-stone-600">{report.report_type} · {report.building_area} · {new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(`${report.event_date}T00:00:00`))}</p></div>
              <div className="flex flex-wrap gap-2">
                {(report.status === "pending" || report.status === "approved" || report.status === "claimed") && <button disabled={busyId === report.id} onClick={() => changeStatus(report)} className="inline-flex items-center gap-2 rounded-lg bg-ndkc-emerald px-3 py-2 text-sm font-bold text-white hover:bg-ndkc-green disabled:opacity-60"><Check size={16} />{busyId === report.id ? "Saving…" : report.status === "claimed" ? "Mark resolved" : "Mark received"}</button>}
                <button disabled={busyId === report.id} onClick={() => setDeleting(report)} aria-label={`Delete ${report.item_name} report`} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"><Trash2 size={16} />Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}
      {deleting && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="delete-report-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><h2 id="delete-report-title" className="text-lg font-extrabold">Delete this report?</h2><p className="mt-2 text-sm leading-6 text-stone-600">“{deleting.item_name}” and its uploaded photo will be permanently removed.</p></div><button onClick={() => setDeleting(null)} aria-label="Close confirmation" className="rounded-md p-1 text-stone-500 hover:bg-stone-100"><X size={18} /></button></div>
            {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="mt-6 flex justify-end gap-2"><button disabled={busyId === deleting.id} onClick={() => setDeleting(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50">Cancel</button><button disabled={busyId === deleting.id} onClick={deleteReport} className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-60">{busyId === deleting.id && <LoaderCircle size={16} className="animate-spin" />}Delete report</button></div>
          </section>
        </div>
      )}
    </section>
  );
}