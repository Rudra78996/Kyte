import Link from "next/link";
import { ArrowRight, Box, ChartNoAxesCombined, GitBranch, Globe2, Layers3, Rocket, Webhook } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const guides = [
  { title: "Connect GitHub", description: "Import a repository and let Kyte detect your framework.", href: "/docs/github", icon: GitBranch },
  { title: "Automate deploys", description: "Deploy every push to the branch you choose for production.", href: "/docs/ci-cd", icon: Webhook },
  { title: "Observe production", description: "Understand traffic, response time, and build health.", href: "/docs/observability", icon: ChartNoAxesCombined },
  { title: "Organize your team", description: "Create workspaces for projects, people, and deployments.", href: "/docs/organizations", icon: Layers3 },
];

const frameworks = [
  { title: "Next.js", detail: "Static export", href: "/docs/nextjs" },
  { title: "React", detail: "Vite", href: "/docs/react" },
  { title: "Vue", detail: "Vite", href: "/docs/vue" },
  { title: "Custom domains", detail: "DNS & SSL", href: "/docs/custom-domains" },
];

export const metadata = { title: "Overview" };

export default function DocsPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <section className="border-b border-border pb-10">
        <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-indigo-400">KYTE PLATFORM GUIDE</Badge>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-0.045em] text-foreground sm:text-5xl">Build, ship, and understand every deployment.</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">Kyte gives frontend teams one place to deploy static applications, connect GitHub, and see what production is doing. Start with your repository, not infrastructure.</p>
        <div className="mt-7 flex flex-wrap gap-3"><Link href="/docs/github" className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90">Start with GitHub <ArrowRight className="size-3.5" /></Link><Link href="/docs/nextjs" className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-[13px] font-medium transition-colors hover:bg-muted">Framework guides <ArrowRight className="size-3.5" /></Link></div>
      </section>

      <section className="py-10"><div className="mb-4 flex items-baseline justify-between gap-4"><div><p className="text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-500">Get to production</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.025em]">A simple deployment flow</h2></div><span className="hidden text-xs text-muted-foreground sm:block">From repository to live URL</span></div><div className="grid gap-3 md:grid-cols-3">{[["01", "Import your repository", "Connect GitHub or add a public repository URL."], ["02", "Confirm the build", "Review Kyte’s detected framework and build settings."], ["03", "Deploy to production", "Follow the live build output until your URL is ready."]].map(([number, title, detail]) => <Card key={number} className="border-border bg-card shadow-none"><CardHeader className="gap-3 px-5 py-5"><span className="font-mono text-[11px] text-zinc-500">{number}</span><CardTitle className="text-sm font-medium">{title}</CardTitle><CardDescription className="text-xs leading-5">{detail}</CardDescription></CardHeader></Card>)}</div></section>

      <section className="border-t border-border py-10"><div className="mb-4"><p className="text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-500">Platform guides</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.025em]">Set up the workflow around your code</h2></div><div className="grid gap-3 sm:grid-cols-2">{guides.map((guide) => { const Icon = guide.icon; return <Link href={guide.href} key={guide.title} className="group"><Card className="h-full border-border bg-card shadow-none transition-colors group-hover:border-zinc-700 group-hover:bg-zinc-900/50"><CardContent className="flex items-start gap-3 p-5"><span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 transition-colors group-hover:text-zinc-200"><Icon className="size-3.5" /></span><span><span className="block text-sm font-medium text-foreground">{guide.title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{guide.description}</span></span><ArrowRight className="ml-auto mt-1 size-3.5 shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-300" /></CardContent></Card></Link>; })}</div></section>

      <section className="border-t border-border py-10"><div className="mb-4 flex items-baseline justify-between"><div><p className="text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-500">Frameworks and hosting</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.025em]">Deploy the frontend you already have</h2></div><Globe2 className="size-4 text-zinc-600" /></div><div className="grid overflow-hidden rounded-lg border border-border sm:grid-cols-2">{frameworks.map((framework, index) => <Link href={framework.href} key={framework.title} className={`group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted ${index < 2 ? 'border-b border-border' : ''} ${index % 2 === 0 ? 'sm:border-r sm:border-border' : ''}`}><span className="flex size-7 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400"><Box className="size-3.5" /></span><span className="flex-1"><span className="block text-sm font-medium">{framework.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{framework.detail}</span></span><ArrowRight className="size-3.5 text-zinc-600 group-hover:text-zinc-300" /></Link>)}</div></section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-5"><div className="flex gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-950 text-zinc-300"><Rocket className="size-3.5" /></span><div><p className="text-sm font-medium">Ready to deploy?</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Open the app, choose a repository, and use the live build console to take it to production.</p><Link href="/new" className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-muted-foreground">Create a project <ArrowRight className="size-3" /></Link></div></div></section>
    </div>
  );
}
