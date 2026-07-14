import type { LucideIcon } from "lucide-react";
import { CheckCircle2, FolderOutput, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type FrameworkGuideProps = {
  framework: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  buildCommand: string;
  outputDirectory: string;
  configLabel: string;
  configCode: string;
  notes: string[];
};

function CodeBlock({ label, code }: { label: string; code: string }) {
  return <div className="overflow-hidden rounded-lg border border-border bg-muted/35"><div className="flex items-center justify-between border-b border-border px-3 py-2"><span className="font-mono text-[10px] text-muted-foreground">{label}</span><span className="flex gap-1"><i className="size-1.5 rounded-full bg-rose-400/70" /><i className="size-1.5 rounded-full bg-amber-300/70" /><i className="size-1.5 rounded-full bg-emerald-400/70" /></span></div><pre className="app-scroll overflow-x-auto p-4 font-mono text-[12px] leading-6 text-foreground"><code>{code}</code></pre></div>;
}

export function FrameworkGuide({ framework, title, description, icon: Icon, accent, buildCommand, outputDirectory, configLabel, configCode, notes }: FrameworkGuideProps) {
  return <article className="animate-in fade-in slide-in-from-bottom-2 duration-500">
    <Badge variant="outline" className={`font-mono text-[10px] ${accent}`}>FRAMEWORK GUIDE</Badge>
    <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_190px] lg:items-end"><div><h1 className="text-4xl font-semibold tracking-[-0.04em]">{title}</h1><p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{description}</p></div><div className={`flex aspect-[1.25] items-end justify-between overflow-hidden rounded-xl border p-5 ${accent}`}><Icon className="size-10" strokeWidth={1.5} /><span className="font-mono text-[11px] uppercase tracking-[0.14em]">{framework}</span></div></div>

    <section className="mt-10"><Card className="overflow-hidden border-border bg-card shadow-none"><CardHeader className="border-b border-border px-5 py-4"><CardTitle className="text-sm font-medium">Deployment recipe</CardTitle><CardDescription className="mt-1 text-xs">Use these values when you create the project in Kyte.</CardDescription></CardHeader><CardContent className="grid gap-0 p-0 sm:grid-cols-2"><div className="border-b border-border p-5 sm:border-b-0 sm:border-r"><p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground"><Terminal className="size-3.5" />Build command</p><code className="mt-4 block w-fit rounded-md border border-border bg-muted px-2.5 py-1.5 font-mono text-xs text-foreground">{buildCommand}</code></div><div className="p-5"><p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground"><FolderOutput className="size-3.5" />Output directory</p><code className="mt-4 block w-fit rounded-md border border-border bg-muted px-2.5 py-1.5 font-mono text-xs text-foreground">{outputDirectory}</code></div></CardContent></Card></section>

    <section className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]"><div><p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Project configuration</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Set up your project for static hosting</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Kyte publishes the files your build produces. Add this configuration before your first deployment if your framework requires it.</p><div className="mt-5"><CodeBlock label={configLabel} code={configCode} /></div></div><Card className="h-fit border-border bg-muted/25 shadow-none"><CardHeader className="px-5 py-5"><CardTitle className="text-sm font-medium">Before you deploy</CardTitle><CardDescription className="mt-4 flex flex-col gap-3 text-xs leading-5">{notes.map((note) => <span key={note} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />{note}</span>)}</CardDescription></CardHeader></Card></section>
  </article>;
}
