"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, Box, ChevronRight, CircleAlert, CircleCheck, GitBranch, GitCommitHorizontal, LoaderCircle, Plus, Search, Sparkles } from "lucide-react";
import { useApiRequest } from "@/hooks/use-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProjectAvatar } from "@/components/project-avatar";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type DeploymentStatus = "QUEUED" | "BUILDING" | "UPLOADING" | "SUCCESS" | "FAILED" | "TIMEOUT" | "CANCELED";

type Deployment = {
  id: string;
  projectId: string;
  status: DeploymentStatus;
  commitSha: string;
  commitMessage?: string | null;
  branch: string;
  triggerSource?: "MANUAL" | "WEBHOOK";
  deployedAt: string;
  updatedAt: string;
};

type Project = {
  id: string;
  name: string;
  subdomain: string;
  preset?: string | null;
  branch?: string | null;
  buildCommand?: string | null;
  outputDirectory?: string | null;
  updatedAt: string;
};

type ProjectWithDeployment = Project & { deployments: Deployment[]; latestDeployment?: Deployment };

export default function Dashboard() {
  const apiRequest = useApiRequest();
  const [projects, setProjects] = useState<ProjectWithDeployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [range, setRange] = useState<"7d" | "30d">("7d");

  const loadWorkspace = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    try {
      // First fetch organizations to scope projects to the active org
      const orgsResponse = await apiRequest("GET", "/organizations") as { organizations?: { id: string }[] };
      const orgs = orgsResponse.organizations || [];
      
      const savedOrgId = typeof window !== 'undefined' ? localStorage.getItem("kyte-active-org") : null;
      const orgId = savedOrgId && orgs.find(o => o.id === savedOrgId) 
        ? savedOrgId 
        : (orgs.length > 0 ? orgs[0].id : null);

      const projectsResponse = await apiRequest("GET", orgId ? `/projects?organizationId=${orgId}` : "/projects") as { projects?: Project[] };
      const fetchedProjects = projectsResponse.projects || [];
      const rows = await Promise.all(fetchedProjects.map(async (project) => {
        try {
          const response = await apiRequest("GET", `/projects/${project.id}/deployments`) as { deployments?: Deployment[] };
          const deployments = response.deployments || [];
          return { ...project, deployments, latestDeployment: deployments[0] };
        } catch {
          return { ...project, deployments: [] };
        }
      }));
      setProjects(rows);
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  useEffect(() => {
    document.title = "Dashboard | Kyte";
    const timer = setTimeout(() => { void loadWorkspace(); }, 0);
    return () => clearTimeout(timer);
  }, [loadWorkspace]);

  const recentDeployments = useMemo(() => projects
    .flatMap((project) => project.deployments.map((deployment) => ({ project, deployment })))
    .sort((a, b) => new Date(b.deployment.deployedAt).getTime() - new Date(a.deployment.deployedAt).getTime())
    .slice(0, 6), [projects]);

  const readyProjects = projects.filter((project) => project.latestDeployment?.status === "SUCCESS").length;
  const attentionProjects = projects.filter((project) => project.latestDeployment?.status === "FAILED" || project.latestDeployment?.status === "TIMEOUT" || project.latestDeployment?.status === "CANCELED").length;
  const deployingProjects = projects.filter((project) => project.latestDeployment?.status === "BUILDING" || project.latestDeployment?.status === "UPLOADING" || project.latestDeployment?.status === "QUEUED").length;
  const filteredProjects = projects.filter((project) => project.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const deploymentTrend = useMemo(() => {
    const rangeLength = range === "7d" ? 7 : 30;
    const days = Array.from({ length: rangeLength }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (rangeLength - 1 - index));
      return { key: date.toISOString().slice(0, 10), label: range === "7d" ? date.toLocaleDateString(undefined, { weekday: "short" }) : date.toLocaleDateString(undefined, { month: "short", day: "numeric" }), successful: 0, unsuccessful: 0, inProgress: 0 };
    });
    const byDay = new Map(days.map((day) => [day.key, day]));
    projects.flatMap((project) => project.deployments).forEach((deployment) => {
      const day = byDay.get(new Date(deployment.deployedAt).toISOString().slice(0, 10));
      if (!day) return;
      if (deployment.status === "SUCCESS") day.successful += 1;
      else if (["FAILED", "TIMEOUT", "CANCELED"].includes(deployment.status)) day.unsuccessful += 1;
      else if (["QUEUED", "BUILDING", "UPLOADING"].includes(deployment.status)) day.inProgress += 1;
    });
    return days;
  }, [projects, range]);
  const deploymentsThisWeek = deploymentTrend.reduce((total, day) => total + day.successful + day.unsuccessful, 0);
  const successfulThisWeek = deploymentTrend.reduce((total, day) => total + day.successful, 0);
  const failedThisWeek = deploymentTrend.reduce((total, day) => total + day.unsuccessful, 0);
  const completedDeployments = successfulThisWeek + failedThisWeek;
  const successRate = completedDeployments ? Math.round((successfulThisWeek / completedDeployments) * 100) : null;
  const projectsNeedingAttention = projects.filter((project) => ["FAILED", "TIMEOUT", "CANCELED"].includes(project.latestDeployment?.status || ""));

  return (
    <div className="app-page flex min-h-full flex-col gap-7">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-label">Workspace</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-foreground">Overview</h1>
          <p className="page-subtitle">Your projects and the latest production activity.</p>
        </div>
        <Button render={<Link href="/new" />}>
          <Plus data-icon="inline-start" />
          New project
        </Button>
      </header>

      {loading ? <DashboardLoading /> : projects.length === 0 ? <WorkspaceEmpty /> : <>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <OverviewMetric icon={Box} label="Projects" value={projects.length} detail={`${readyProjects} serving production`} tone="zinc" />
          <OverviewMetric icon={CircleCheck} label="Release health" value={successRate === null ? "—" : `${successRate}%`} detail={completedDeployments ? `${successfulThisWeek} successful in ${range}` : "No completed releases yet"} tone="emerald" />
          <OverviewMetric icon={LoaderCircle} label="In progress" value={deployingProjects} detail={deployingProjects ? "Builds currently moving" : "Nothing is building right now"} tone="amber" />
          <OverviewMetric icon={CircleAlert} label="Needs attention" value={attentionProjects} detail={attentionProjects ? "Latest release needs review" : "All latest releases look good"} tone={attentionProjects ? "rose" : "zinc"} />
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="overflow-hidden border-border bg-card shadow-none"><div className="flex flex-col gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="section-label">Release activity</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.025em]">Production delivery history</h2><p className="mt-1 text-xs text-muted-foreground">Successful and failed releases across the workspace.</p></div><Tabs value={range} onValueChange={(value) => setRange(value as "7d" | "30d")}><TabsList aria-label="Release activity range"><TabsTrigger value="7d" className="px-2 text-xs">7 days</TabsTrigger><TabsTrigger value="30d" className="px-2 text-xs">30 days</TabsTrigger></TabsList></Tabs></div><CardContent className="p-0"><div className="h-[270px] px-1 pb-2 pt-5 sm:h-[310px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={deploymentTrend} margin={{ top: 5, right: 18, left: -18, bottom: 0 }} barCategoryGap={range === "7d" ? "32%" : "18%"}><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 4" /><XAxis axisLine={false} dataKey="label" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} dy={8} interval={range === "30d" ? 4 : 0} /><YAxis allowDecimals={false} axisLine={false} tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} /><Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--foreground))" }} labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: 4 }} /><Bar dataKey="successful" fill="#e4e4e7" name="Successful" radius={[3, 3, 0, 0]} /><Bar dataKey="unsuccessful" fill="#fb7185" name="Failed" radius={[3, 3, 0, 0]} /><Bar dataKey="inProgress" fill="#fbbf24" name="In progress" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-muted-foreground"><div className="flex flex-wrap items-center gap-4"><Legend color="bg-zinc-200" label="Successful" value={successfulThisWeek} /><Legend color="bg-rose-400" label="Failed" value={failedThisWeek} /><Legend color="bg-amber-300" label="In progress" value={deployingProjects} /></div><span className="font-mono text-[10px]">{deploymentsThisWeek} releases</span></div></CardContent></Card>

          <Card className="overflow-hidden border-border bg-card shadow-none"><div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4"><div><p className="section-label">Production check</p><h2 className="mt-1 text-base font-medium">What needs your eye</h2></div>{projectsNeedingAttention.length ? <span className="flex size-7 items-center justify-center rounded-md border border-rose-500/20 bg-rose-500/10 text-rose-300"><CircleAlert className="size-3.5" /></span> : <span className="flex size-7 items-center justify-center rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"><Sparkles className="size-3.5" /></span>}</div>{projectsNeedingAttention.length ? <div className="divide-y divide-border">{projectsNeedingAttention.slice(0, 4).map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/50"><ProjectAvatar projectId={project.id} size={30} className="rounded-md" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{project.name}</p><p className="mt-1 text-xs text-muted-foreground">{project.latestDeployment?.status === "TIMEOUT" ? "Latest build timed out" : "Latest release failed"}</p></div><ChevronRight className="size-4 text-muted-foreground" /></Link>)}</div> : <div className="flex min-h-[210px] flex-col items-center justify-center px-6 text-center"><span className="flex size-10 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"><CircleCheck className="size-5" /></span><p className="mt-4 text-sm font-medium">Production looks healthy</p><p className="mt-1 max-w-52 text-xs leading-5 text-muted-foreground">Every project&apos;s latest deployment is ready or has not been deployed yet.</p></div>}<div className="border-t border-border bg-muted/20 px-5 py-3"><Button variant="ghost" size="sm" className="-ml-2" render={<Link href="/dashboard/deployments" />}>Review deployment history<ArrowUpRight data-icon="inline-end" /></Button></div></Card>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="overflow-hidden border-border bg-card shadow-none"><div className="flex flex-col gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="section-label">Projects</p><h2 className="mt-1 text-base font-medium">Your production fleet</h2></div><div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search projects" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="h-8 w-full pl-8 text-xs sm:w-52" /></div></div><CardContent className="app-scroll max-h-[410px] overflow-y-auto p-0"><div className="divide-y divide-border">{filteredProjects.length ? filteredProjects.map((project) => <ProjectRow key={project.id} project={project} />) : <div className="px-6 py-12 text-center"><p className="text-sm font-medium">No matching projects</p><p className="mt-1 text-xs text-muted-foreground">Try a different project name.</p></div>}</div></CardContent></Card>
          <Card className="overflow-hidden border-border bg-card shadow-none"><div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4"><div><p className="section-label">Recent activity</p><h2 className="mt-1 text-base font-medium">Release feed</h2></div><Button variant="ghost" size="sm" render={<Link href="/dashboard/deployments" />}>History<ArrowUpRight data-icon="inline-end" /></Button></div>{recentDeployments.length ? <div className="divide-y divide-border">{recentDeployments.slice(0, 4).map(({ project, deployment }) => <DeploymentRow key={deployment.id} project={project} deployment={deployment} compact />)}</div> : <div className="px-5 py-12 text-center text-sm text-muted-foreground">Your releases will appear here.</div>}<div className="border-t border-border bg-muted/20 px-5 py-4"><Button variant="ghost" size="sm" className="-ml-2" render={<Link href="/new" />}>Create project<Plus data-icon="inline-end" /></Button></div></Card>
        </section>
      </>}
    </div>
  );
}

function OverviewMetric({ detail, icon: Icon, label, tone, value }: { detail: string; icon: LucideIcon; label: string; tone: "zinc" | "emerald" | "amber" | "rose"; value: number | string }) {
  const tones = { zinc: "border-zinc-700 bg-zinc-800/50 text-zinc-300", emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300", amber: "border-amber-500/20 bg-amber-500/10 text-amber-300", rose: "border-rose-500/20 bg-rose-500/10 text-rose-300" };
  return <Card className="border-border bg-card shadow-none"><CardContent className="flex items-start justify-between gap-4 p-5"><div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-3 text-2xl font-semibold tracking-[-0.04em]">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><span className={`flex size-8 items-center justify-center rounded-md border ${tones[tone]}`}><Icon className="size-4" /></span></CardContent></Card>;
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return <span className="flex items-center gap-1.5"><span className={`size-1.5 rounded-sm ${color}`} />{label} <span className="font-mono text-[10px] text-foreground">{value}</span></span>;
}

function ProjectRow({ project }: { project: ProjectWithDeployment }) {
  const deployment = project.latestDeployment;
  return <Link href={`/projects/${project.id}`} className="grid gap-4 px-6 py-4 transition-colors hover:bg-muted/50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
    <div className="flex items-center gap-4 min-w-0">
      <ProjectAvatar projectId={project.id} size={40} className="rounded-md shadow-sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><p className="truncate text-base font-medium">{project.name}</p><Badge variant="outline" className="font-normal">{project.preset || "Other"}</Badge></div>
        <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><GitBranch className="size-3 text-orange-400" />{project.branch || "main"}</span><span className="truncate">{project.subdomain}.localhost</span></div>
      </div>
    </div>
    <div className="flex items-center gap-4 sm:justify-end"><StatusBadge status={deployment?.status} /><ChevronRight className="size-4 text-muted-foreground" /></div>
  </Link>;
}

function DeploymentRow({ project, deployment, compact = false }: { project: Project; deployment: Deployment; compact?: boolean }) {
  return <Link href={`/projects/${project.id}`} className={`grid gap-2 px-5 py-3.5 transition-colors hover:bg-muted/50 ${compact ? "sm:grid-cols-[minmax(0,1fr)_auto]" : "sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-6"} sm:items-center`}>
    <div className="min-w-0"><p className="truncate text-sm font-medium">{deployment.commitMessage || `Deployment ${deployment.commitSha.slice(0, 7)}`}</p><p className="mt-1 text-xs text-muted-foreground">{project.name} · {relativeTime(deployment.deployedAt)}</p></div>
    {!compact && <span className="hidden items-center gap-2 font-mono text-xs text-muted-foreground sm:flex"><GitCommitHorizontal className="size-3" />{deployment.commitSha.slice(0, 7)}</span>}<StatusBadge status={deployment.status} />
  </Link>;
}

function StatusBadge({ status }: { status?: DeploymentStatus }) {
  const labels: Record<DeploymentStatus, string> = { SUCCESS: "Ready", FAILED: "Failed", BUILDING: "Building", UPLOADING: "Uploading", QUEUED: "Queued", TIMEOUT: "Timed out", CANCELED: "Canceled" };
  const isFailure = status === "FAILED" || status === "TIMEOUT" || status === "CANCELED";
  const dotColor = isFailure ? "bg-red-400" : status === "BUILDING" || status === "UPLOADING" ? "animate-pulse bg-zinc-200" : "bg-zinc-400";
  return <Badge variant="outline" className={`gap-2 border-border bg-muted/30 font-normal ${isFailure ? "text-red-400" : "text-zinc-300"}`}><span className={`size-1.5 rounded-full ${dotColor}`} />{status ? labels[status] : "Not deployed"}</Badge>;
}

function WorkspaceEmpty() {
  return <Card><CardContent className="flex min-h-80 flex-col items-center justify-center px-6 text-center"><span className="flex size-10 items-center justify-center rounded border border-border bg-muted"><Box className="size-4 text-muted-foreground" /></span><p className="mt-4 text-sm font-medium">Start with a repository</p><p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">Import a Git repository, configure its build, and deploy it to production.</p><Button className="mt-6" render={<Link href="/new" />}><Plus data-icon="inline-start" />New project</Button></CardContent></Card>;
}

function DashboardLoading() {
  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-12"><div className="h-72 rounded-lg border border-border bg-card lg:col-span-8" /><div className="h-72 rounded-lg border border-border bg-card lg:col-span-4" /></div>;
}

function relativeTime(date: string) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
