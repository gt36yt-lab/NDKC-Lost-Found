"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, LogOut, Mail, Plus, Search, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Notification, OwnedReport, Profile, PublicReport } from "@/lib/types";
import { NotificationDrawer } from "@/components/notification-drawer";
import { OwnerReportManagement } from "@/components/owner-report-management";

const PAGE_SIZE = 12;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}

export function Dashboard({ profile, initialReports, initialOwnedReports, notifications }: { profile: Profile; initialReports: PublicReport[]; initialOwnedReports: OwnedReport[]; notifications: Notification[] }) {
  const router = useRouter();
  const [reports, setReports] = useState(initialReports);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialReports.length === PAGE_SIZE);

  const categories = useMemo(() => Array.from(new Set(reports.map((item) => item.category))).sort(), [reports]);
  const filtered = reports.filter((item) => {
    const text = `${item.item_name} ${item.category} ${item.building_area} ${item.specific_location ?? ""}`.toLowerCase();
    return text.includes(search.toLowerCase()) &&
      (type === "all" || item.report_type === type) &&
      (category === "all" || item.category === category);
  });

  async function loadMore() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from("public_reports").select("*")
        .order("created_at", { ascending: false }).range(reports.length, reports.length + PAGE_SIZE - 1);
      if (error) throw error;
      const next = (data ?? []) as PublicReport[];
      setReports((current) => [...current, ...next]);
      setHasMore(next.length === PAGE_SIZE);
    } catch (error) {
      console.error("Unable to load more reports", error);
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    const { error } = await createClient().auth.signOut();
    if (error) {
      console.error("Unable to sign out", error);
      return;
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-ndkc-cream">
      <header className="bg-ndkc-green text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Image src="/Logo.jpg" alt="NDKC seal" width={44} height={44} className="h-11 w-11 rounded-full bg-white object-contain p-0.5" />
            <span className="hidden sm:block"><span className="block text-xs font-bold uppercase tracking-widest text-ndkc-gold">Notre Dame of Kidapawan College</span><span className="text-sm font-semibold">Lost &amp; Found</span></span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden items-center gap-2 rounded-xl bg-white/10 px-3 py-2 sm:flex">
              <UserRound size={18} className="text-ndkc-gold" />
              <span><span className="block text-sm font-semibold">{profile.full_name}</span><span className="block text-xs text-white/75">ID: {profile.student_id}</span></span>
            </div>
            {profile.is_admin && <Link href="/admin" className="rounded-lg px-3 py-2 text-sm font-bold text-ndkc-gold hover:bg-white/10">Admin</Link>}
            <NotificationDrawer notifications={notifications} />
            {process.env.NEXT_PUBLIC_LOST_AND_FOUND_EMAIL ? (
              <a aria-label="Email the Lost and Found office" href={`mailto:${process.env.NEXT_PUBLIC_LOST_AND_FOUND_EMAIL}`} className="rounded-lg p-2 hover:bg-white/10"><Mail size={20} /></a>
            ) : (
              <button aria-label="Office email is not configured" title="Office email is not configured" disabled className="cursor-not-allowed rounded-lg p-2 text-white/40"><Mail size={20} /></button>
            )}
            <button onClick={signOut} aria-label="Sign out" className="rounded-lg p-2 hover:bg-white/10"><LogOut size={19} /></button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 pb-16 pt-8">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-ndkc-green to-ndkc-emerald px-7 py-9 text-white shadow-soft sm:px-10 sm:py-12">
          <div className="absolute -right-8 -top-24 h-72 w-72 rounded-full border-[35px] border-white/5" />
          <div className="relative max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-ndkc-gold">Every item has a way home</p>
            <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">Lost something? Found something?</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/80">Share a report with the NDKC community and help reunite belongings with their owners.</p>
            <Link href="/report" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-ndkc-gold px-5 py-3 text-sm font-extrabold text-ndkc-green transition hover:bg-yellow-300"><Plus size={18} /> REPORT HERE</Link>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-ndkc-emerald">Community board</p><h2 className="mt-1 text-2xl font-extrabold">Recent reports</h2></div>
            <div className="grid gap-2 sm:grid-cols-[minmax(200px,1fr)_150px_170px]">
              <label className="relative"><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" /><input className="field pl-10" placeholder="Search item or location" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search reports" /></label>
              <label className="relative"><select className="field appearance-none pr-10" value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter report type"><option value="all">All reports</option><option value="lost">Lost items</option><option value="found">Found items</option></select><ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-500" /></label>
              <select className="field" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter category"><option value="all">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center"><p className="font-semibold text-stone-700">No reports match your search.</p><p className="mt-1 text-sm text-stone-500">Try changing the filters or submit a new report.</p></div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((item) => (
                <article key={item.id} className="overflow-hidden rounded-2xl bg-white shadow-soft">
                  <div className="relative h-48 bg-gradient-to-br from-emerald-50 to-stone-100">
                    {item.image_url ? <Image src={item.image_url} alt={item.item_name} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw" unoptimized className="object-cover" /> : <div className="grid h-full place-items-center text-sm font-semibold text-stone-400">No photo provided</div>}
                    <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold uppercase ${item.report_type === "lost" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-800"}`}>{item.report_type}</span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2"><h3 className="font-bold text-stone-900">{item.item_name}</h3><span className="rounded-md bg-stone-100 px-2 py-1 text-[11px] font-semibold text-stone-600">{item.category}</span></div>
                    <p className="mt-2 line-clamp-2 text-sm text-stone-600">{item.description}</p>
                    <p className="mt-3 text-sm font-semibold text-ndkc-green">{item.building_area}{item.specific_location ? ` · ${item.specific_location}` : ""}</p>
                    <p className="mt-2 text-xs text-stone-400">{formatDate(item.event_date)}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
          {hasMore && <div className="mt-8 text-center"><button disabled={loading} onClick={loadMore} className="rounded-lg border border-ndkc-emerald px-5 py-3 text-sm font-bold text-ndkc-emerald hover:bg-emerald-50 disabled:opacity-60">{loading ? "Loading…" : "Load more reports"}</button></div>}
        </section>

        <OwnerReportManagement initialReports={initialOwnedReports} />
      </div>
    </main>
  );
}
