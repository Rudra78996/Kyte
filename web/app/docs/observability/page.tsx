import { Activity, Gauge, MapPinned, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ObservabilityPreview } from "@/components/docs-visuals";

const metrics = [
  { title: "Traffic", detail: "Browser pageviews and unique visitors with assets, probes, bots, and Kyte previews filtered out.", icon: Activity },
  { title: "Traffic location", detail: "A country-level breakdown of where visitors reach your project.", icon: MapPinned },
  { title: "Response time", detail: "The average server response time for tracked HTML page loads.", icon: Gauge },
  { title: "Build health", detail: "Build duration and the percentage of deployments that succeed.", icon: Timer },
];

export const metadata = { title: "Observability" };

export default function ObservabilityDocs() {
  return (
    <article className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <Badge variant="outline" className="font-mono text-[10px] border-emerald-500/30 bg-emerald-500/10 text-emerald-400">OPERATE</Badge>
      <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">Observability</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">Understand what happens after deployment without learning a new analytics tool. Kyte puts production traffic, performance, and build health alongside the project you already manage.</p>

      <section className="mt-10"><ObservabilityPreview /></section>

      <section className="mt-10"><p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Signals in one view</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Start with the questions you already ask</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{metrics.map((metric) => { const Icon = metric.icon; return <Card key={metric.title} className="border-border bg-card shadow-none"><CardHeader className="flex-row items-center gap-3 px-5 py-4"><span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground"><Icon className="size-3.5" /></span><div><CardTitle className="text-sm font-medium">{metric.title}</CardTitle><CardDescription className="mt-1 text-xs leading-5">{metric.detail}</CardDescription></div></CardHeader></Card>; })}</div></section>

      <section className="mt-10 border-t border-border pt-8"><h2 className="text-lg font-semibold tracking-[-0.02em]">Open it from any project</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Choose the Observability tab in project details to inspect 7, 30, or 90 days of traffic alongside location, response time, build duration, and deployment success rate. Metrics load when the page opens or the range changes; use Reload when you want a fresh snapshot. Kyte does not poll observability in the background.</p></section>
      <section className="mt-10 border-t border-border pt-8"><h2 className="text-lg font-semibold tracking-[-0.02em]">How traffic is counted</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Kyte counts successful HTML navigations from browsers. Static assets, prefetches, automated clients, monitoring probes, and dashboard preview requests are excluded. Bot filtering is best effort, so highly sophisticated browser automation may still appear.</p></section>
    </article>
  );
}
