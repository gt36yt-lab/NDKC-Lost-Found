import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };
type UserChanges = {
  full_name?: string;
  student_id?: string;
  email?: string;
  course_dept?: string;
  is_admin?: boolean;
};

const studentEmail = (studentId: string) => `${studentId}@ndkc.edu.ph`;

async function authorizeAdmin() {
  const sessionClient = await createClient();
  const { data: { user }, error: authError } = await sessionClient.auth.getUser();
  if (authError || !user) return { error: NextResponse.json({ error: "Please sign in." }, { status: 401 }) };
  const { data: profile, error: profileError } = await sessionClient.from("profiles")
    .select("is_admin").eq("id", user.id).single();
  if (profileError || !profile?.is_admin) {
    return { error: NextResponse.json({ error: "Administrator access is required." }, { status: 403 }) };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return { error: NextResponse.json({ error: "Server admin actions are not configured." }, { status: 503 }) };
  }
  const adminClient = createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return { actor: user, adminClient };
}

async function readChanges(request: Request): Promise<UserChanges | null> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const changes = body as Record<string, unknown>;
    const result: UserChanges = {};
    for (const key of ["full_name", "student_id", "email", "course_dept"] as const) {
      if (key in changes) {
        if (typeof changes[key] !== "string") return null;
        result[key] = changes[key].trim();
      }
    }
    if (result.student_id !== undefined) result.student_id = result.student_id.toLowerCase();
    if ("is_admin" in changes) {
      if (typeof changes.is_admin !== "boolean") return null;
      result.is_admin = changes.is_admin;
    }
    if (Object.keys(result).length === 0) return null;
    if (result.full_name !== undefined && (!result.full_name || result.full_name.length > 120)) return null;
    if (result.student_id !== undefined && !/^[a-zA-Z0-9-]{3,32}$/.test(result.student_id)) return null;
    if (result.email !== undefined && result.email.length > 254) return null;
    if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) return null;
    if (result.course_dept !== undefined && result.course_dept.length > 120) return null;
    return result;
  } catch {
    return null;
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const authorization = await authorizeAdmin();
  if ("error" in authorization) return authorization.error;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid account ID." }, { status: 400 });
  const changes = await readChanges(request);
  if (!changes) return NextResponse.json({ error: "Enter valid account details." }, { status: 400 });

  const { data: current, error: loadError } = await authorization.adminClient.from("profiles")
    .select("*").eq("id", id).single();
  if (loadError || !current) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (changes.is_admin === false && current.is_admin) {
    if (id === authorization.actor.id) {
      return NextResponse.json({ error: "You cannot remove your own administrator access here." }, { status: 409 });
    }
    const { count, error: countError } = await authorization.adminClient.from("profiles")
      .select("id", { count: "exact", head: true }).eq("is_admin", true);
    if (countError) return NextResponse.json({ error: "Unable to verify administrator count." }, { status: 500 });
    if ((count ?? 0) <= 1) return NextResponse.json({ error: "At least one administrator must remain." }, { status: 409 });
  }

  const updated = { ...current, ...changes };
  const { error: updateError } = await authorization.adminClient.from("profiles").update({
    full_name: updated.full_name,
    student_id: updated.student_id,
    email: updated.email,
    course_dept: updated.course_dept,
    is_admin: updated.is_admin,
  }).eq("id", id);
  if (updateError) {
    const status = updateError.code === "23505" ? 409 : 400;
    return NextResponse.json({ error: updateError.code === "23505" ? "That student ID is already in use." : "Unable to update account." }, { status });
  }

  const { data: authUserData, error: authLoadError } = await authorization.adminClient.auth.admin.getUserById(id);
  if (!authLoadError && authUserData.user) {
    const metadata = {
      ...authUserData.user.user_metadata,
      full_name: updated.full_name,
      student_id: updated.student_id,
      contact_email: updated.email || null,
      course_dept: updated.course_dept,
    };
    const authChanges: { user_metadata: Record<string, unknown>; email?: string; email_confirm?: boolean } = { user_metadata: metadata };
    if (updated.student_id !== current.student_id) {
      authChanges.email = studentEmail(updated.student_id);
      authChanges.email_confirm = true;
    }
    const { error: authUpdateError } = await authorization.adminClient.auth.admin.updateUserById(id, authChanges);
    if (authUpdateError) {
      await authorization.adminClient.from("profiles").update({
        full_name: current.full_name,
        student_id: current.student_id,
        email: current.email,
        course_dept: current.course_dept,
        is_admin: current.is_admin,
      }).eq("id", id);
      return NextResponse.json({ error: "Auth details could not be synchronized; the profile change was reverted." }, { status: 502 });
    }
  } else if (authLoadError) {
    await authorization.adminClient.from("profiles").update({
      full_name: current.full_name,
      student_id: current.student_id,
      email: current.email,
      course_dept: current.course_dept,
      is_admin: current.is_admin,
    }).eq("id", id);
    return NextResponse.json({ error: "Unable to load the account's authentication record." }, { status: 502 });
  }

  return NextResponse.json({ profile: updated });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const authorization = await authorizeAdmin();
  if ("error" in authorization) return authorization.error;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid account ID." }, { status: 400 });
  if (id === authorization.actor.id) return NextResponse.json({ error: "You cannot delete the account you are currently using." }, { status: 409 });

  const { data: target, error: targetError } = await authorization.adminClient.from("profiles")
    .select("is_admin").eq("id", id).single();
  if (targetError || !target) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (target.is_admin) {
    const { count, error: countError } = await authorization.adminClient.from("profiles")
      .select("id", { count: "exact", head: true }).eq("is_admin", true);
    if (countError) return NextResponse.json({ error: "Unable to verify administrator count." }, { status: 500 });
    if ((count ?? 0) <= 1) return NextResponse.json({ error: "Promote another administrator before deleting this account." }, { status: 409 });
  }

  const { error: deleteError } = await authorization.adminClient.auth.admin.deleteUser(id);
  if (deleteError) return NextResponse.json({ error: "Unable to delete account." }, { status: 500 });

  while (true) {
    const { data: files, error: listError } = await authorization.adminClient.storage.from("item-photos")
      .list(id, { limit: 100, offset: 0 });
    if (listError || !files?.length) break;
    const paths = files.filter((file) => file.name).map((file) => `${id}/${file.name}`);
    if (paths.length) {
      const { error: photoError } = await authorization.adminClient.storage.from("item-photos").remove(paths);
      if (photoError) {
        console.error("Unable to remove a deleted user's report photos", photoError);
        break;
      }
    }
    if (files.length < 100) break;
  }
  return NextResponse.json({ ok: true });
}