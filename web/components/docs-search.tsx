"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Command, CornerDownLeft, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const entries = [
  { title: "Documentation overview", href: "/docs", category: "Getting started", description: "Learn the Kyte deployment workflow." },
  { title: "Deploy a Next.js app", href: "/docs/nextjs", category: "Frameworks", description: "Configure a static export for Next.js." },
  { title: "Deploy a React app", href: "/docs/react", category: "Frameworks", description: "Deploy a Vite-powered React app." },
  { title: "Deploy a Vue app", href: "/docs/vue", category: "Frameworks", description: "Deploy a Vue or Vite application." },
  { title: "GitHub integration", href: "/docs/github", category: "Platform", description: "Connect a repository and automate deployments." },
  { title: "Continuous deployment", href: "/docs/ci-cd", category: "Platform", description: "Deploy every push to your production branch." },
  { title: "Observability", href: "/docs/observability", category: "Platform", description: "Understand traffic, performance, and build health." },
  { title: "Organizations", href: "/docs/organizations", category: "Platform", description: "Create and manage team workspaces." },
  { title: "Custom domains", href: "/docs/custom-domains", category: "Guides", description: "Connect your own domain to a project." },
];

export function DocsSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? entries.filter((entry) => `${entry.title} ${entry.category} ${entry.description}`.toLowerCase().includes(term)) : entries;
  }, [query]);

  const select = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex h-8 w-full items-center gap-2 rounded-md border border-border bg-card px-2.5 text-left text-xs text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground sm:w-64">
        <Search className="size-3.5" />
        <span className="flex-1">Search documentation</span>
        <span className="hidden items-center gap-0.5 rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground sm:flex"><Command className="size-2.5" />K</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="max-w-[560px] gap-0 overflow-hidden border border-zinc-800 bg-zinc-950 p-0 shadow-2xl shadow-black/50">
          <DialogHeader className="sr-only"><DialogTitle>Search documentation</DialogTitle><DialogDescription>Search Kyte documentation and guides.</DialogDescription></DialogHeader>
          <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3"><Search className="size-4 text-zinc-500" /><Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search guides, frameworks, and features…" className="h-auto border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0" /></div>
          <div className="app-scroll max-h-[360px] overflow-y-auto p-2">
            {results.length ? results.map((entry) => (
              <button type="button" key={entry.href} onClick={() => select(entry.href)} className="group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-zinc-900">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 group-hover:text-zinc-200"><BookOpen className="size-3.5" /></span>
                <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium text-zinc-200">{entry.title}</span><span className="mt-0.5 block truncate text-xs text-zinc-500">{entry.description}</span></span>
                <span className="hidden text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-600 sm:block">{entry.category}</span>
              </button>
            )) : <div className="px-3 py-10 text-center text-sm text-zinc-500">No guides match “{query}”.</div>}
          </div>
          <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-900/30 px-4 py-2 text-[10px] text-zinc-500"><span>Search the Kyte platform guides</span><span className="flex items-center gap-1"><CornerDownLeft className="size-3" />Open</span></div>
        </DialogContent>
      </Dialog>
    </>
  );
}
