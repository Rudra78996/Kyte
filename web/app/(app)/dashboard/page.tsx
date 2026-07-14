"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Box, ChevronRight, GitBranch, GitCommitHorizontal, Plus, Rocket, Settings2 } from "lucide-react";
import { useApiRequest } from "@/hooks/use-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProjectAvatar } from "@/components/project-avatar";

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

type ProjectWithDeployment = Project & { latestDeployment?: Deployment };

export default function Dashboard() {
  const apiRequest = useApiRequest();
  const [projects, setProjects] = useState<ProjectWithDeployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

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
          return { ...project, latestDeployment: response.deployments?.[0] };
        } catch {
          return project;
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
    .flatMap((project) => project.latestDeployment ? [{ project, deployment: project.latestDeployment }] : [])
    .sort((a, b) => new Date(b.deployment.deployedAt).getTime() - new Date(a.deployment.deployedAt).getTime())
    .slice(0, 5), [projects]);

  const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

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
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <Card className="overflow-hidden rounded-lg lg:col-span-8">
            <CardHeader className="flex-row items-center justify-between gap-4 border-b border-border px-5 py-4">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-sm font-medium">Projects</CardTitle>
                <CardDescription>Current production state for each project.</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Input 
                  placeholder="Search projects..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-[200px]"
                />
                <Button variant="ghost" size="sm" render={<Link href="/new" />}>Add project<Plus data-icon="inline-end" /></Button>
              </div>
            </CardHeader>
            <CardContent className="app-scroll relative h-[312px] overflow-y-auto p-0">
              <div className="divide-y divide-border">
                {filteredProjects.map((project) => <ProjectRow key={project.id} project={project} />)}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4 lg:col-span-4">
            <Card className="overflow-hidden rounded-lg">
              <CardHeader className="border-b border-border px-5 py-4">
                <CardTitle className="text-sm font-medium">Quick actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 p-3">
                <Button variant="ghost" className="h-9 justify-start text-[13px]" render={<Link href="/new" />}><Plus data-icon="inline-start" />Import repository</Button>
                <Button variant="ghost" className="h-9 justify-start text-[13px]" render={<Link href="/dashboard/deployments" />}><Rocket data-icon="inline-start" />Review deployments</Button>
                <Button variant="ghost" className="h-9 justify-start text-[13px]" render={<Link href="/settings" />}><Settings2 data-icon="inline-start" />Workspace settings</Button>
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-lg">
              <CardHeader className="border-b border-border px-5 py-4">
                <CardTitle className="text-sm font-medium">Workspace snapshot</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 p-4 text-sm">
                <MetaRow label="Projects" value={String(projects.length)} />
                <MetaRow label="Frameworks" value={[...new Set(projects.map((project) => project.preset || "Other"))].join(", ")} />
                <MetaRow label="Production branch" value={[...new Set(projects.map((project) => project.branch || "main"))].join(", ")} />
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <Card className="overflow-hidden rounded-lg lg:col-span-8">
            <CardHeader className="flex-row items-center justify-between gap-4 border-b border-border px-5 py-4">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-sm font-medium">Recent deployments</CardTitle>
                <CardDescription>Most recent deployment for each project.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" render={<Link href="/dashboard/deployments" />}>View all<ArrowUpRight data-icon="inline-end" /></Button>
            </CardHeader>
            <CardContent className="p-0">
              {recentDeployments.length ? <div className="divide-y divide-border">{recentDeployments.slice(0, 2).map(({ project, deployment }) => <DeploymentRow key={deployment.id} project={project} deployment={deployment} />)}</div> : <div className="px-6 py-10 text-center"><p className="text-sm font-medium">No deployments yet</p><p className="mt-1 text-sm text-muted-foreground">Deploy a repository to see build activity here.</p></div>}
            </CardContent>
          </Card>
          <Card className="overflow-hidden rounded-lg lg:col-span-4">
            <CardHeader className="border-b border-border px-5 py-4">
              <CardTitle className="text-sm font-medium">Production snapshot</CardTitle>
              <CardDescription>Output directories from your live projects.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 p-4 text-sm">
              {projects.slice(0, 3).map((project) => <div key={project.id} className="flex items-center justify-between gap-2"><span className="truncate text-muted-foreground">{project.name}</span><Badge variant="outline" className="shrink-0 font-mono text-[10px]">{project.outputDirectory || "dist"}</Badge></div>)}
            </CardContent>
          </Card>
        </section>
      </>}
    </div>
  );
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

function DeploymentRow({ project, deployment }: { project: Project; deployment: Deployment }) {
  return <Link href={`/projects/${project.id}`} className="grid gap-2 px-6 py-4 transition-colors hover:bg-muted/50 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-6">
    <div className="min-w-0"><p className="truncate text-sm font-medium">{deployment.commitMessage || `Deployment ${deployment.commitSha.slice(0, 7)}`}</p><p className="mt-1 text-xs text-muted-foreground">{project.name} · {relativeTime(deployment.deployedAt)}</p></div>
    <span className="hidden items-center gap-2 font-mono text-xs text-muted-foreground sm:flex"><GitCommitHorizontal className="size-3 text-cyan-400" />{deployment.commitSha.slice(0, 7)}</span>
    <StatusBadge status={deployment.status} />
  </Link>;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="max-w-[60%] text-right text-xs text-zinc-300">{value}</span></div>;
}

function StatusBadge({ status }: { status?: DeploymentStatus }) {
  const labels: Record<DeploymentStatus, string> = { SUCCESS: "Ready", FAILED: "Failed", BUILDING: "Building", UPLOADING: "Uploading", QUEUED: "Queued", TIMEOUT: "Timed out", CANCELED: "Canceled" };
  const dotColor = status === "SUCCESS" ? "bg-emerald-500" : status === "FAILED" ? "bg-red-500" : status === "BUILDING" || status === "UPLOADING" ? "bg-amber-400 animate-pulse" : status === "TIMEOUT" || status === "CANCELED" ? "bg-zinc-500" : "bg-zinc-400";
  const textColor = status === "SUCCESS" ? "text-emerald-400" : status === "FAILED" ? "text-red-400" : status === "BUILDING" || status === "UPLOADING" ? "text-amber-300" : "text-zinc-300";
  const borderColor = status === "SUCCESS" ? "border-emerald-500/30" : status === "FAILED" ? "border-red-500/30" : status === "BUILDING" || status === "UPLOADING" ? "border-amber-500/30" : "border-zinc-700";
  return <Badge variant="outline" className={`gap-2 bg-zinc-900 font-normal ${textColor} ${borderColor}`}><span className={`size-1.5 rounded-full ${dotColor}`} />{status ? labels[status] : "Not deployed"}</Badge>;
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
