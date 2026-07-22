import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const links = [
  { href: "/docs", label: "Documentation" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
  { href: "/terms", label: "Terms" },
];

export default function MarketingFooter({ blend = false }: { blend?: boolean }) {
  return (
    <footer className={cn(
      "px-6 py-10 text-neutral-400",
      blend
        ? "relative z-10 -mt-20 border-0 bg-gradient-to-b from-transparent via-neutral-950/85 to-neutral-950 pt-24"
        : "border-t border-neutral-800/70 bg-neutral-950",
    )}>
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
        {!blend && (
          <Link href="/" className="flex w-fit items-center gap-3 text-white" aria-label="Kyte home">
            <Image src="/kite-flying.png" alt="" width={24} height={24} className="object-contain invert" />
            <span className="text-sm font-semibold tracking-[0.14em]"><span className="text-neutral-500">K</span>yte</span>
          </Link>
        )}
        <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm" aria-label="Footer navigation">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-white">{link.label}</Link>
          ))}
        </nav>
        <p className="text-xs text-neutral-600">© {new Date().getFullYear()} Kyte</p>
      </div>
    </footer>
  );
}
