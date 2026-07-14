import { GitCommitHorizontal, RotateCw, ShieldCheck, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DeploymentRun } from "@/components/docs-visuals";

const guarantees = [
  { title: "A clean build every time", detail: "Each deployment starts with a fresh build environment and the configuration saved on the project.", icon: RotateCw },
  { title: "Visibility while it runs", detail: "Watch install, build, and publish output as it happens from the project deployment view.", icon: Timer },
  { title: "Production changes on success", detail: "Kyte only updates the production deployment when the build has completed successfully.", icon: ShieldCheck },
];

export const metadata = { title: "Continuous Deployment" };

export default function CiCdDocs() {
  return (
    <article className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <Badge variant="outline" className="font-mono text-[10px] border-emerald-500/30 bg-emerald-500/10 text-emerald-400">DEPLOY</Badge>
      <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">Continuous deployment</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">Every commit to your production branch can become a release. Kyte handles the event, build, output checks, and production update as one connected run.</p>

      <section className="mt-10"><DeploymentRun /></section>

      <section className="mt-10"><div className="flex items-center gap-2"><GitCommitHorizontal className="size-4 text-muted-foreground" /><h2 className="text-lg font-semibold tracking-[-0.02em]">What happens after a push</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-3">{guarantees.map((item) => { const Icon = item.icon; return <Card key={item.title} className="border-border bg-card shadow-none"><CardHeader className="px-5 py-5"><span className="flex size-8 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground"><Icon className="size-3.5" /></span><CardTitle className="mt-5 text-sm font-medium">{item.title}</CardTitle><CardDescription className="mt-1 text-xs leading-5">{item.detail}</CardDescription></CardHeader></Card>; })}</div></section>
    </article>
  );
}
