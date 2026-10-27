import { Brand } from "@/components/brand";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <main className="auth-backdrop flex min-h-screen flex-col px-5 py-6">
      <header className="mx-auto w-full max-w-6xl"><Brand /></header>
      <section className="mx-auto my-auto w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-ndkc-emerald">Notre Dame of Kidapawan College</p>
        <h1 className="mb-6 mt-2 text-2xl font-extrabold text-stone-900">Log In - How can we help you?</h1>
        <AuthForm mode="login" />
      </section>
      <p className="pt-8 text-center text-xs text-white/75">A safer way to reconnect people with their belongings.</p>
    </main>
  );
}
