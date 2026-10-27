import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3" aria-label="NDKC Lost and Found home">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/30 bg-white/10 text-sm font-black tracking-wide text-ndkc-gold">
        NDKC
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-ndkc-gold">Notre Dame of Kidapawan College</span>
          <span className="mt-1 block text-sm font-semibold text-white">Lost &amp; Found Reporting System</span>
        </span>
      )}
    </Link>
  );
}
