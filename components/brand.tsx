import Link from "next/link";
import Image from "next/image";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3" aria-label="NDKC Lost and Found home">
      <Image src="/Logo.jpg" alt="Notre Dame of Kidapawan College seal" width={48} height={48} className="h-12 w-12 shrink-0 rounded-full bg-white object-contain p-0.5" priority />
      {!compact && (
        <span className="leading-tight">
          <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-ndkc-gold">Notre Dame of Kidapawan College</span>
          <span className="mt-1 block text-sm font-semibold text-white">Lost &amp; Found Reporting System</span>
        </span>
      )}
    </Link>
  );
}
