"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useState } from "react";
import { ArrowLeft, ImagePlus, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Reporter = { id: string; full_name: string; student_id: string; email: string };
const categories = ["Wallets", "Electronics", "ID Cards", "Cash/Money", "Books", "Keys", "Bags", "Other"];

export function ReportForm({ reporter }: { reporter: Reporter }) {
  const router = useRouter();
  const [reportType, setReportType] = useState<"lost" | "found">("lost");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setPhotoError("");
    if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPhoto(null);
      setPhotoError("Choose a JPG, PNG, or WebP image.");
    } else if (file && file.size > 5 * 1024 * 1024) {
      setPhoto(null);
      setPhotoError("Images must be 5 MB or smaller.");
    } else {
      setPhoto(file);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const supabase = createClient();
    let imageUrl: string | null = null;
    try {
      if (photo) {
        const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
        const path = `${reporter.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("item-photos").upload(path, photo, {
          contentType: photo.type,
          cacheControl: "3600",
          upsert: false,
        });
        if (uploadError) throw uploadError;
        imageUrl = supabase.storage.from("item-photos").getPublicUrl(path).data.publicUrl;
      }

      const payload = {
        report_type: reportType,
        contact_number: String(form.get("contact_number") ?? ""),
        course_dept: String(form.get("course_dept") ?? ""),
        year_section: String(form.get("year_section") ?? ""),
        email: String(form.get("email") ?? ""),
        item_name: String(form.get("item_name") ?? ""),
        category: String(form.get("category") ?? ""),
        brand: String(form.get("brand") ?? ""),
        color: String(form.get("color") ?? ""),
        description: String(form.get("description") ?? ""),
        image_url: imageUrl,
        event_date: String(form.get("event_date") ?? ""),
        building_area: String(form.get("building_area") ?? ""),
        approx_time: String(form.get("approx_time") ?? ""),
        specific_location: String(form.get("specific_location") ?? ""),
        remarks: String(form.get("remarks") ?? ""),
        agreed_to_contact: form.get("agreed_to_contact") === "on",
        certified_true: form.get("certified_true") === "on",
      };
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) {
        if (imageUrl) {
          const path = imageUrl.split("/item-photos/")[1];
          if (path) {
            const { error: cleanupError } = await supabase.storage.from("item-photos").remove([path]);
            if (cleanupError) console.error("Unable to clean up unused report photo", cleanupError);
          }
        }
        throw new Error(result.error ?? "Unable to submit your report.");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to submit your report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-ndkc-emerald hover:underline"><ArrowLeft size={16} /> Back to reports</Link>
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-ndkc-emerald">Help the community</p><h1 className="mt-1 text-3xl font-extrabold">Submit a report</h1><p className="mt-2 text-sm text-stone-600">Please share accurate details. Contact information is not shown on the public board.</p></div>
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-stone-100 p-1.5">
        {(["lost", "found"] as const).map((value) => <button type="button" key={value} onClick={() => setReportType(value)} className={`rounded-lg px-4 py-3 text-sm font-bold transition ${reportType === value ? "bg-ndkc-green text-white shadow" : "text-stone-600 hover:bg-white"}`}>I {value.toUpperCase()} an item</button>)}
      </div>

      <section className="space-y-4">
        <SectionTitle number="01" title="Reporter information" />
        <div className="grid gap-4 sm:grid-cols-2">
          <ReadOnly label="Full Name" value={reporter.full_name} />
          <ReadOnly label="ID / Student No." value={reporter.student_id} />
          <Field label="Course / Department" name="course_dept" />
          <Field label="Year / Section" name="year_section" />
          <Field label="Contact Number" name="contact_number" required type="tel" />
          <Field label="Email Address" name="email" type="email" defaultValue={reporter.email} />
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle number="02" title="Item details" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Item Name" name="item_name" placeholder="e.g. Black wallet" required />
          <label><span className="form-label">Category <Required /></span><select className="field" name="category" required defaultValue=""><option value="" disabled>Select a category</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <Field label="Brand / Make" name="brand" />
          <Field label="Color" name="color" />
          <label className="sm:col-span-2"><span className="form-label">Detailed Description <Required /></span><textarea className="field min-h-28 resize-y" name="description" placeholder="Describe identifying marks, stickers, damage, or other details." maxLength={2000} required /></label>
          <label className="sm:col-span-2"><span className="form-label">Photo <span className="font-normal text-stone-400">(optional, max 5 MB)</span></span><span className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-stone-300 p-5 hover:border-ndkc-emerald"><ImagePlus className="text-ndkc-emerald" /><span className="text-sm text-stone-600">{photo ? photo.name : "Choose a JPG, PNG, or WebP photo"}</span><input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} /></span>{photoError && <span role="alert" className="mt-1 block text-sm text-red-700">{photoError}</span>}</label>
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle number="03" title="Where and when" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Date ${reportType === "lost" ? "lost" : "found"}`} name="event_date" type="date" required />
          <Field label="Building or Area" name="building_area" placeholder="e.g. Main Building, Canteen" required />
          <Field label="Approx. Time" name="approx_time" type="time" />
          <Field label="Specific Location" name="specific_location" placeholder="e.g. hallway, room 201" />
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle number="04" title="Additional information" />
        <label className="block"><span className="form-label">Remarks</span><textarea className="field min-h-24 resize-y" name="remarks" maxLength={1000} /></label>
        <label className="flex items-start gap-3 text-sm text-stone-700"><input className="mt-1 accent-ndkc-emerald" name="agreed_to_contact" type="checkbox" />I agree to be contacted by the Lost &amp; Found office.</label>
        <label className="flex items-start gap-3 text-sm font-semibold text-stone-800"><input className="mt-1 accent-ndkc-emerald" name="certified_true" type="checkbox" required />I certify that the information above is true and correct.</label>
      </section>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy || Boolean(photoError)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-ndkc-emerald px-5 py-3.5 font-bold text-white hover:bg-ndkc-green disabled:cursor-not-allowed disabled:opacity-60">
        {busy && <LoaderCircle className="animate-spin" size={18} />}{busy ? "Submitting report…" : "Submit Report"}
      </button>
    </form>
  );
}

function Required() { return <span className="text-red-600">*</span>; }
function SectionTitle({ number, title }: { number: string; title: string }) {
  return <h2 className="flex items-center gap-3 border-b border-stone-200 pb-3 text-lg font-bold"><span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-xs font-extrabold text-ndkc-emerald">{number}</span>{title}</h2>;
}
function Field({ label, name, type = "text", required = false, placeholder, defaultValue }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string; defaultValue?: string }) {
  return <label className="block"><span className="form-label">{label} {required && <Required />}</span><input className="field" name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue} maxLength={type === "text" ? 160 : undefined} /></label>;
}
function ReadOnly({ label, value }: { label: string; value: string }) {
  return <label className="block"><span className="form-label">{label}</span><input className="field bg-stone-100 text-stone-600" value={value} readOnly /></label>;
}
