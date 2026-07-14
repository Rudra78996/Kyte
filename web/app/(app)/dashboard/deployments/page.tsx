"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, GitBranch, GitCommitHorizontal, RefreshCw, Search } from "lucide-react";
import { useApiRequest } from "@/hooks/use-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectAvatar } from "@/components/project-avatar";

type Status = "QUEUED" | "BUILDING" | "UPLOADING" | "SUCCESS" | "FAILED" | "TIMEOUT" | "CANCELED";
type Project = { id: string; name: string; subdomain: string; repoUrl: string; preset?: string | null };
type Deployment = { id: string; projectId: string; status: Status; commitSha: string; commitMessage?: string | null; branch: string; triggerSource?: "MANUAL" | "WEBHOOK"; deployedAt: string; updatedAt: string };
type DeploymentRow = Deployment & { project: Project };

export default function DeploymentsPage() {
  const apiRequest = useApiRequest();
  const [rows, setRows] = useState<DeploymentRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "in-progress" | Status>("all");
  const [loading, setLoading] = useState(true);
  const [deployingId, setDeployingId] = useState<string | null>(null);

  const loadDeployments = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    try {
      const projectData = await apiRequest("GET", "/projects") as { projects?: Project[] };
      const projects = projectData.projects || [];
      const groups = await Promise.all(projects.map(async (project) => {
        try {
          const result = await apiRequest("GET", `/projects/${project.id}/deployments`) as { deployments?: Deployment[] };
          return (result.deployments || []).map((deployment) => ({ ...deployment, project }));
        } catch {
          return [] as DeploymentRow[];
        }
      }));
      setRows(groups.flat().sort((a, b) => new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime()));
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  useEffect(() => {
    document.title = "Deployments | Kyte";
    const timer = setTimeout(() => { void loadDeployments(); }, 0);
    return () => clearTimeout(timer);
  }, [loadDeployments]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const searchable = `${row.project.name} ${row.commitSha} ${row.commitMessage || ""} ${row.branch}`.toLowerCase();
    return searchable.includes(query.toLowerCase()) && (status === "all" || (status === "in-progress" ? ["QUEUED", "BUILDING", "UPLOADING"].includes(row.status) : row.status === status));
  }), [query, rows, status]);

  const [page, setPage] = useState(1);
  const perPage = 6;
  const totalPages = Math.ceil(filteredRows.length / perPage);
  
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredRows.slice(start, start + perPage);
  }, [filteredRows, page, perPage]);

  const redeploy = async (row: DeploymentRow) => {
    setDeployingId(row.id);
    try {
      await apiRequest("POST", `/projects/${row.projectId}/deployments`, { repoUrl: row.project.repoUrl, branch: row.branch, commitSha: row.commitSha, commitMessage: row.commitMessage || undefined, trigger: "manual" });
      await loadDeployments();
    } finally {
      setDeployingId(null);
    }
  };

  return <div className="app-page flex min-h-full flex-col gap-6">
    <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="section-label">Workspace activity</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Deployments</h1><p className="page-subtitle">Every deployment across this workspace.</p></div>
    </header>

    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center">
      <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} className="pl-8" placeholder="Search deployments" /></div>
      <div className="flex gap-1 overflow-x-auto"><FilterButton active={status === "all"} onClick={() => { setStatus("all"); setPage(1); }}>All</FilterButton><FilterButton active={status === "SUCCESS"} onClick={() => { setStatus("SUCCESS"); setPage(1); }}>Ready</FilterButton><FilterButton active={status === "in-progress"} onClick={() => { setStatus("in-progress"); setPage(1); }}>In progress</FilterButton><FilterButton active={status === "FAILED"} onClick={() => { setStatus("FAILED"); setPage(1); }}>Failed</FilterButton></div>
    </section>

    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="hidden grid-cols-[minmax(220px,1.8fr)_150px_145px_minmax(180px,1fr)_160px] gap-4 border-b border-border bg-zinc-900/40 px-6 py-2.5 text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 md:grid"><span>Deployment</span><span>Status</span><span>Project</span><span>Source</span><span className="text-right">Created</span></div>
      {loading ? <LoadingRows /> : filteredRows.length ? (
        <>
          {paginatedRows.map((row) => (
            <DeploymentItem key={row.id} row={row} redeploy={redeploy} deploying={deployingId === row.id} />
          ))}
          {filteredRows.length > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Showing {((page - 1) * perPage) + 1} to {Math.min(page * perPage, filteredRows.length)} of {filteredRows.length}
              </p>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      ) : <EmptyDeployments query={query} />}
    </section>
  </div>;
}

function DeploymentItem({ row, redeploy, deploying }: { row: DeploymentRow; redeploy: (row: DeploymentRow) => Promise<void>; deploying: boolean }) {
  const duration = formatDuration(row.deployedAt, row.updatedAt);
  return <div className="group grid gap-4 border-b border-border px-6 py-4 transition-colors last:border-0 hover:bg-zinc-900/50 md:grid-cols-[minmax(220px,1.8fr)_150px_145px_minmax(180px,1fr)_160px] md:items-center md:gap-4">
    <div className="min-w-0"><Link href={`/projects/${row.projectId}`} className="block truncate text-sm font-medium hover:underline">{row.commitMessage || `Deployment ${row.commitSha.slice(0, 7)}`}</Link><div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><span className="font-mono">{row.commitSha.slice(0, 7)}</span><span className="md:hidden">· {row.project.name}</span></div></div>
    <DeploymentStatus status={row.status} duration={duration} />
    <Link href={`/projects/${row.projectId}`} className="hidden items-center gap-2 text-sm text-zinc-300 hover:text-white md:flex"><ProjectAvatar projectId={row.projectId} size={24} className="rounded-md border border-zinc-800 bg-zinc-900" /><span className="truncate">{row.project.name}</span></Link>
    <div className="hidden items-center gap-4 text-xs text-muted-foreground md:flex"><span className="flex items-center gap-2"><GitCommitHorizontal className="size-3" />{row.commitSha.slice(0, 7)}</span><span className="flex items-center gap-2"><GitBranch className="size-3" />{row.branch}</span><Badge variant="outline" className="font-normal">{row.triggerSource === "WEBHOOK" ? "Git push" : "Manual"}</Badge></div>
    <div className="flex items-center justify-between gap-2 md:justify-end"><span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(row.deployedAt)}</span><div className="flex items-center gap-1"><Button variant="ghost" size="icon-xs" title="View project" render={<Link href={`/projects/${row.projectId}`} />}><FileText /></Button><Button variant="ghost" size="icon-xs" title="Redeploy" disabled={deploying} onClick={() => void redeploy(row)}>{deploying ? <RefreshCw className="animate-spin" /> : <RefreshCw />}</Button>{row.status === "SUCCESS" && <Button variant="ghost" size="icon-xs" title="Visit deployment" render={<a href={`http://${row.project.subdomain}.localhost`} target="_blank" rel="noreferrer" />}><ExternalLink /></Button>}</div></div>
  </div>;
}

function DeploymentStatus({ status, duration }: { status: Status; duration: string }) {
  const label: Record<Status, string> = { SUCCESS: "Ready", FAILED: "Failed", BUILDING: "Building", UPLOADING: "Uploading", QUEUED: "Queued", TIMEOUT: "Timed out", CANCELED: "Canceled" };
  const dotColor = status === "SUCCESS" ? "bg-emerald-500" : status === "FAILED" ? "bg-red-500" : status === "BUILDING" || status === "UPLOADING" ? "bg-amber-400 animate-pulse" : "bg-zinc-400";
  const textColor = status === "SUCCESS" ? "text-emerald-400" : status === "FAILED" ? "text-red-400" : status === "BUILDING" || status === "UPLOADING" ? "text-amber-300" : "text-zinc-300";
  const borderColor = status === "SUCCESS" ? "border-emerald-500/30" : status === "FAILED" ? "border-red-500/30" : status === "BUILDING" || status === "UPLOADING" ? "border-amber-500/30" : "border-zinc-700";
  return <div><Badge variant="outline" className={`gap-2 bg-zinc-900 font-normal ${textColor} ${borderColor}`}><span className={`size-1.5 rounded-full ${dotColor}`} />{label[status]}<span className="text-zinc-500">{duration}</span></Badge></div>;
}

function FilterButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) { return <Button variant={active ? "secondary" : "ghost"} size="sm" onClick={onClick}>{children}</Button>; }
function LoadingRows() { return <div className="divide-y divide-border">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-[73px] animate-pulse bg-card" />)}</div>; }
function EmptyDeployments({ query }: { query: string }) { return <div className="px-6 py-16 text-center"><p className="text-sm font-medium">{query ? "No matching deployments" : "No deployments yet"}</p><p className="mt-1 text-sm text-muted-foreground">{query ? "Try a different project, branch, or commit." : "Deploy a project to start building your timeline."}</p></div>; }
function formatDate(value: string) { const d = new Date(value); const now = new Date(); const diffMs = now.getTime() - d.getTime(); const diffMin = Math.floor(diffMs / 60000); if (diffMin < 1) return 'Just now'; if (diffMin < 60) return `${diffMin}m ago`; const diffHr = Math.floor(diffMin / 60); if (diffHr < 24) return `${diffHr}h ago`; const diffDays = Math.floor(diffHr / 24); if (diffDays < 7) return `${diffDays}d ago`; return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
function formatDuration(start: string, end: string) { const seconds = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)); return seconds ? `${seconds}s` : "—"; }
