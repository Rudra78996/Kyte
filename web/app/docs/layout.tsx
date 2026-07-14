import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, BookOpen, Box, Cable, ChartNoAxesCombined, ChevronRight, GitBranch, Layers3, Rocket } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DocsSearch } from "@/components/docs-search";

const navigation = [
  { label: "Getting started", items: [{ title: "Overview", href: "/docs", icon: BookOpen }, { title: "GitHub integration", href: "/docs/github", icon: GitBranch }, { title: "Organizations", href: "/docs/organizations", icon: Layers3 }] },
  { label: "Deploy", items: [{ title: "Next.js", href: "/docs/nextjs", icon: Box }, { title: "React", href: "/docs/react", icon: Box }, { title: "Vue", href: "/docs/vue", icon: Box }, { title: "Continuous deployment", href: "/docs/ci-cd", icon: Cable }] },
  { label: "Operate", items: [{ title: "Observability", href: "/docs/observability", icon: ChartNoAxesCombined }, { title: "Custom domains", href: "/docs/custom-domains", icon: ArrowUpRight }] },
];

export const metadata = {
  title: {
    template: "%s | Kyte Docs",
    default: "Documentation | Kyte",
  },
};

export const viewport = {
  themeColor: "#000000",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/docs" className="flex items-center gap-2.5"><Image src="/kite-flying.png" alt="Kyte Logo" width={22} height={22} className="object-contain invert dark:invert" /><span className="text-sm font-semibold tracking-[-0.02em] text-zinc-100">Kyte Docs</span></Link>
          <span className="hidden h-4 w-px bg-border sm:block" />
          <span className="hidden text-xs text-muted-foreground sm:block">Platform documentation</span>
          <div className="ml-auto flex items-center gap-3"><DocsSearch /><Link href="/dashboard" className="hidden items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground md:flex">Open app <ChevronRight className="size-3" /></Link></div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 self-start border-r border-border lg:block">
          <ScrollArea className="h-full py-7 pr-5">
            <nav className="flex flex-col gap-6">
              {navigation.map((section) => <div key={section.label}><p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-500">{section.label}</p><div className="flex flex-col gap-0.5">{section.items.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><Icon className="size-3.5 text-zinc-500 transition-colors group-hover:text-zinc-300" />{item.title}</Link>; })}</div></div>)}
            </nav>
          </ScrollArea>
        </aside>
        <main className="min-w-0 flex-1 py-8 lg:px-12 lg:py-12"><div className="mx-auto w-full max-w-4xl">{children}</div></main>
      </div>
    </div>
  );
}
