import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const text = (value: unknown, max: number) => typeof value === "string" && value.length <= max ? value.trim() : "";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in to submit a report." }, { status: 401 });
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, student_id")
    .eq("id", user.id)
    .single();
  if (profileError || !profile) {
    console.error("Unable to load profile for report submission", profileError);
    return NextResponse.json({ error: "Your student profile could not be verified." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid request body.");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid report data." }, { status: 400 });
  }

  const reportType = body.report_type;
  const requiredFields = ["contact_number", "item_name", "category", "description", "event_date", "building_area"] as const;
  const values = Object.fromEntries(requiredFields.map((key) => [key, text(body[key], key === "description" ? 2000 : 200)]));
  if (reportType !== "lost" && reportType !== "found") {
    return NextResponse.json({ error: "Select whether the item was lost or found." }, { status: 400 });
  }
  if (requiredFields.some((key) => !values[key])) {
    return NextResponse.json({ error: "Complete all required report fields." }, { status: 400 });
  }
  if (body.certified_true !== true) {
    return NextResponse.json({ error: "Certification is required before submission." }, { status: 400 });
  }
  if (typeof body.image_url === "string") {
    const expectedPrefix = `${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin}/storage/v1/object/public/item-photos/${user.id}/`;
    if (!body.image_url.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: "The uploaded photo URL is invalid." }, { status: 400 });
    }
  }
  const eventDate = text(body.event_date, 10);
  const parsedDate = new Date(`${eventDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== eventDate) {
    return NextResponse.json({ error: "Enter a valid date." }, { status: 400 });
  }
  const email = text(body.email, 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const { error } = await supabase.from("reports").insert({
    user_id: user.id,
    report_type: reportType,
    full_name: profile.full_name,
    student_id: profile.student_id,
    course_dept: text(body.course_dept, 120),
    year_section: text(body.year_section, 80),
    contact_number: values.contact_number,
    email,
    item_name: values.item_name,
    category: values.category,
    brand: text(body.brand, 120),
    color: text(body.color, 80),
    description: values.description,
    image_url: typeof body.image_url === "string" ? body.image_url : null,
    event_date: eventDate,
    building_area: values.building_area,
    approx_time: text(body.approx_time, 30),
    specific_location: text(body.specific_location, 160),
    remarks: text(body.remarks, 1000),
    agreed_to_contact: body.agreed_to_contact === true,
    certified_true: true,
  });
  if (error) {
    console.error("Report insert failed", error);
    return NextResponse.json({ error: "Your report could not be saved. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
