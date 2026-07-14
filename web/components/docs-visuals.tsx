"use client";

import { useState, type SVGProps } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { Check, CircleDotDashed, GitCommitHorizontal, Globe2, Webhook } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const GithubIcon = (props: SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"></path></svg>;

const flow = [
  { label: "GitHub", detail: "push to main", icon: GithubIcon },
  { label: "Webhook", detail: "event received", icon: Webhook },
  { label: "Kyte build", detail: "npm run build", icon: CircleDotDashed },
  { label: "Production", detail: "deployment ready", icon: Globe2 },
];

export function IntegrationFlow() {
  return (
    <Card className="overflow-hidden border-border bg-card shadow-none">
      <CardHeader className="border-b border-border px-5 py-4">
        <div className="flex items-center justify-between gap-4"><div><CardTitle className="text-sm font-medium">The deployment path</CardTitle><CardDescription className="mt-1 text-xs">A push event moves through Kyte without a separate CI pipeline.</CardDescription></div><Badge variant="secondary" className="font-mono text-[10px]">LIVE FLOW</Badge></div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid divide-y divide-border sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          {flow.map((step, index) => { const Icon = step.icon; return <div key={step.label} className="relative min-h-28 px-5 py-5"><span className="font-mono text-[10px] text-muted-foreground">0{index + 1}</span><div className="mt-4 flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground"><Icon className="size-3.5" /></span><p className="text-sm font-medium">{step.label}</p></div><p className="mt-2 font-mono text-[11px] text-muted-foreground">{step.detail}</p></div>; })}
        </div>
        <div className="flex items-center gap-2 border-t border-border bg-muted/30 px-5 py-3 text-xs text-muted-foreground"><Check className="size-3.5" /><span>Kyte creates a fresh deployment only after it receives the GitHub event.</span></div>
      </CardContent>
    </Card>
  );
}

export function DeploymentRun() {
  return (
    <Card className="overflow-hidden border-border bg-card shadow-none">
      <CardHeader className="flex-row items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div><CardTitle className="text-sm font-medium">Deployment run</CardTitle><CardDescription className="mt-1 font-mono text-[11px]">main · 9f3a20c · 43s</CardDescription></div>
        <Badge className="bg-primary text-primary-foreground hover:bg-primary">Ready</Badge>
      </CardHeader>
      <CardContent className="grid gap-0 p-0 sm:grid-cols-[minmax(0,1fr)_180px]">
        <div className="app-scroll max-h-56 overflow-y-auto border-b border-border bg-muted/20 p-5 font-mono text-[11px] leading-6 text-muted-foreground sm:border-b-0 sm:border-r">
          <p><span className="text-foreground">14:21:07</span> event received from GitHub</p>
          <p><span className="text-foreground">14:21:10</span> installing dependencies</p>
          <p><span className="text-foreground">14:21:26</span> running npm run build</p>
          <p><span className="text-foreground">14:21:47</span> output verified: dist</p>
          <p><span className="text-foreground">14:21:50</span> production deployment ready</p>
        </div>
        <div className="flex flex-col justify-between gap-6 p-5"><div><p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Output</p><p className="mt-2 text-sm font-medium">2.4 MB</p><p className="mt-1 text-xs text-muted-foreground">78 files deployed</p></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><GitCommitHorizontal className="size-3.5" />Production updated</div></div>
      </CardContent>
    </Card>
  );
}

const traffic = {
  "7d": { total: "12,480", change: "+18.4%", points: [{ label: "Mon", views: 1120 }, { label: "Tue", views: 1430 }, { label: "Wed", views: 1310 }, { label: "Thu", views: 1760 }, { label: "Fri", views: 1890 }, { label: "Sat", views: 2040 }, { label: "Sun", views: 2930 }] },
  "30d": { total: "48,912", change: "+12.1%", points: [{ label: "Jun 16", views: 9200 }, { label: "Jun 20", views: 10400 }, { label: "Jun 24", views: 9800 }, { label: "Jun 28", views: 12520 }, { label: "Jul 02", views: 13740 }, { label: "Jul 06", views: 15030 }, { label: "Today", views: 18910 }] },
  "90d": { total: "136,720", change: "+24.8%", points: [{ label: "Apr", views: 32000 }, { label: "May", views: 39200 }, { label: "Jun", views: 36800 }, { label: "Jul 01", views: 44900 }, { label: "Jul 04", views: 50600 }, { label: "Jul 08", views: 57200 }, { label: "Today", views: 64100 }] },
};

function TrafficTooltip({ active, payload, label }: { active?: boolean; payload?: { value?: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-lg"><p className="font-mono text-[10px] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{payload[0].value?.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">views</span></p></div>;
}

export function ObservabilityPreview() {
  const [period, setPeriod] = useState<keyof typeof traffic>("7d");
  const current = traffic[period];

  return <Tabs value={period} onValueChange={(value) => setPeriod(value as keyof typeof traffic)} className="w-full"><Card className="w-full overflow-hidden border-border bg-card shadow-none"><CardHeader className="flex-row items-start justify-between gap-4 border-b border-border px-5 py-4"><div><CardTitle className="text-sm font-medium">Production traffic</CardTitle><CardDescription className="mt-1 text-xs">Hover the chart to inspect each point.</CardDescription></div><div className="text-right"><p className="text-sm font-medium">{current.total}<span className="ml-1 text-xs font-normal text-muted-foreground">views</span></p><p className="mt-1 text-xs text-emerald-400">{current.change} from previous period</p></div></CardHeader><CardContent className="p-5"><TabsList aria-label="Traffic date range"><TabsTrigger value="7d" className="px-2 text-xs">7 days</TabsTrigger><TabsTrigger value="30d" className="px-2 text-xs">30 days</TabsTrigger><TabsTrigger value="90d" className="px-2 text-xs">90 days</TabsTrigger></TabsList>{(["7d", "30d", "90d"] as const).map((range) => <TabsContent key={range} value={range} className="mt-5"><div className="h-48"><ResponsiveContainer width="100%" height="100%"><AreaChart data={traffic[range].points} margin={{ top: 8, right: 6, bottom: 0, left: -18 }}><defs><linearGradient id={`traffic-${range}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.22} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><Tooltip cursor={{ stroke: "hsl(var(--muted-foreground))", strokeDasharray: "3 3" }} content={<TrafficTooltip />} /><Area type="monotone" dataKey="views" stroke="hsl(var(--primary))" strokeWidth={2} fill={`url(#traffic-${range})`} activeDot={{ r: 4, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }} /></AreaChart></ResponsiveContainer></div><div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">{traffic[range].points.map((point) => <span key={point.label}>{point.label}</span>)}</div></TabsContent>)}</CardContent></Card></Tabs>;
}
