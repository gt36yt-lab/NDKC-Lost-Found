"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const studentEmail = (id: string) => `${id.trim().toLowerCase()}@ndkc.edu.ph`;

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isSignup = mode === "signup";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const studentId = String(data.get("studentId") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const supabase = createClient();

    try {
      if (isSignup) {
        const fullName = String(data.get("fullName") ?? "").trim();
        const courseDept = String(data.get("courseDept") ?? "").trim();
        const confirm = String(data.get("confirmPassword") ?? "");
        const email = String(data.get("email") ?? "").trim();
        if (password !== confirm) throw new Error("Passwords do not match.");
        if (!/^[A-Za-z0-9-]{3,32}$/.test(studentId)) {
          throw new Error("Use a valid student ID (3–32 letters, numbers, or hyphens).");
        }
        const { error: signupError } = await supabase.auth.signUp({
          email: studentEmail(studentId),
          password,
          options: {
            data: { full_name: fullName, student_id: studentId, contact_email: email || null, course_dept: courseDept },
          },
        });
        if (signupError) throw signupError;
        router.push("/dashboard");
        router.refresh();
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: studentEmail(studentId),
          password,
        });
        if (loginError) throw loginError;
        router.push("/dashboard");
        router.refresh();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to complete authentication.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {isSignup && (
        <label className="block">
          <span className="form-label">Full Name</span>
          <input className="field" name="fullName" autoComplete="name" required maxLength={120} />
        </label>
      )}
      {isSignup && (
        <label className="block">
          <span className="form-label">Course / Department</span>
          <input className="field" name="courseDept" maxLength={120} />
        </label>
      )}
      <label className="block">
        <span className="form-label">Student ID Number</span>
        <input className="field" name="studentId" autoComplete="username" required maxLength={32} />
      </label>
      {isSignup && (
        <label className="block">
          <span className="form-label">Email Address <span className="font-normal text-stone-400">(optional)</span></span>
          <input className="field" name="email" type="email" autoComplete="email" maxLength={254} />
        </label>
      )}
      <label className="block">
        <span className="form-label">Password</span>
        <input className="field" name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} minLength={8} required />
      </label>
      {isSignup && (
        <label className="block">
          <span className="form-label">Confirm Password</span>
          <input className="field" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
        </label>
      )}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-ndkc-emerald px-4 py-3 font-bold text-white transition hover:bg-ndkc-green disabled:cursor-not-allowed disabled:opacity-60">
        {busy ? "Please wait…" : isSignup ? "Register Account" : "Log In / Enter"}
      </button>
      <p className="text-center text-sm text-stone-600">
        {isSignup ? "Already have an account? " : "Don’t have an account? "}
        <Link className="font-bold text-ndkc-emerald underline-offset-4 hover:underline" href={isSignup ? "/login" : "/signup"}>
          {isSignup ? "Log In" : "Sign Up"}
        </Link>
      </p>
    </form>
  );
}
