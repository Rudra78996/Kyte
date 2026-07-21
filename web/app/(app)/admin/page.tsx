"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Ban,
  CheckCircle2,
  Gauge,
  LoaderCircle,
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useApiRequest } from "@/hooks/use-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type PlatformSettings = {
  deploymentsPaused: boolean;
  defaultProjectLimit: number;
};

type Overview = {
  users: number;
  projects: number;
  deployments: number;
  activeDeployments: number;
  settings: PlatformSettings;
};

type AdminUser = {
  id: string;
  email: string;
  username?: string | null;
  role: "USER" | "ADMIN";
  projectLimitOverride?: number | null;
  _count: { projects: number; githubConnections?: number };
};

type AdminProject = {
  id: string;
  name: string;
  subdomain: string;
  repoUrl: string;
  user: { email: string };
  activeDeploy?: { status: string } | null;
  _count: { deployments: number; customDomains: number };
};

type AdminDeployment = {
  id: string;
  status: string;
  commitSha: string;
  triggerSource: string;
  deployedAt: string;
  project: { id: string; name: string; user: { email: string } };
};

type ConfirmAction =
  | { kind: "delete-user"; id: string; label: string }
  | { kind: "delete-project"; id: string; label: string }
  | { kind: "cancel-deployment"; id: string; label: string };

export default function AdminPage() {
  const apiRequest = useApiRequest();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [deployments, setDeployments] = useState<AdminDeployment[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [saving, setSaving] = useState(false);

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    try {
      const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
      const [overviewRes, usersRes, projectsRes, deploymentsRes] = await Promise.all([
        apiRequest("GET", "/admin/overview") as Promise<Overview>,
        apiRequest("GET", `/admin/users${query}`) as Promise<{ users: AdminUser[] }>,
        apiRequest("GET", `/admin/projects${query}`) as Promise<{ projects: AdminProject[] }>,
        apiRequest("GET", "/admin/deployments") as Promise<{ deployments: AdminDeployment[] }>,
      ]);
      setOverview(overviewRes);
      setUsers(usersRes.users || []);
      setProjects(projectsRes.projects || []);
      setDeployments(deploymentsRes.deployments || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load admin panel");
    } finally {
      setLoading(false);
    }
  }, [apiRequest, search]);

  useEffect(() => {
    document.title = "Admin | Kyte";
    const timer = setTimeout(() => {
      void loadAdmin();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadAdmin]);

  const activeDeployments = useMemo(
    () => deployments.filter((deployment) => ["QUEUED", "BUILDING", "UPLOADING"].includes(deployment.status)),
    [deployments],
  );

  async function updateSettings(patch: Partial<PlatformSettings>) {
    setSaving(true);
    try {
      const settings = await apiRequest("PATCH", "/admin/settings", patch) as PlatformSettings;
      setOverview((current) => current ? { ...current, settings } : current);
      toast.success("Platform settings updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update settings");
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(user: AdminUser, patch: Partial<Pick<AdminUser, "role" | "projectLimitOverride">>) {
    try {
      await apiRequest("PATCH", `/admin/users/${user.id}`, patch);
      toast.success("User updated");
      await loadAdmin();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update user");
    }
  }

  async function runConfirmedAction() {
    if (!confirmAction) return;
    try {
      if (confirmAction.kind === "delete-user") {
        await apiRequest("DELETE", `/admin/users/${confirmAction.id}`);
      } else if (confirmAction.kind === "delete-project") {
        await apiRequest("DELETE", `/admin/projects/${confirmAction.id}`);
      } else {
        await apiRequest("POST", `/admin/deployments/${confirmAction.id}/cancel`);
      }
      toast.success("Admin action completed");
      setConfirmAction(null);
      await loadAdmin();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    }
  }

  if (loading && !overview) {
    return <div className="app-page"><Card><CardContent className="flex min-h-80 items-center justify-center"><LoaderCircle className="animate-spin" /></CardContent></Card></div>;
  }

  return (
    <div className="app-page flex min-h-full flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-label">Admin</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-foreground">Platform control</h1>
          <p className="page-subtitle">Manage users, hosted websites, deployment flow, and platform limits.</p>
        </div>
        <Button variant="outline" onClick={() => void loadAdmin()} disabled={loading}>
          <RefreshCw data-icon="inline-start" />
          Refresh
        </Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Users} label="Users" value={overview?.users ?? 0} />
        <Metric icon={Gauge} label="Projects" value={overview?.projects ?? 0} />
        <Metric icon={CheckCircle2} label="Deployments" value={overview?.deployments ?? 0} />
        <Metric icon={LoaderCircle} label="Active builds" value={overview?.activeDeployments ?? activeDeployments.length} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Platform switches</CardTitle>
            <CardDescription>Stop new deployments during maintenance and set the default project allowance.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">New deployments</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Existing builds continue unless you cancel them below.
                  </p>
                </div>
                <Badge variant={overview?.settings.deploymentsPaused ? "destructive" : "secondary"}>
                  {overview?.settings.deploymentsPaused ? "Paused" : "Open"}
                </Badge>
              </div>
              <Button
                className="mt-4 w-full"
                variant={overview?.settings.deploymentsPaused ? "default" : "outline"}
                disabled={saving}
                onClick={() => void updateSettings({ deploymentsPaused: !overview?.settings.deploymentsPaused })}
              >
                {overview?.settings.deploymentsPaused ? <Play data-icon="inline-start" /> : <Pause data-icon="inline-start" />}
                {overview?.settings.deploymentsPaused ? "Resume deployments" : "Pause deployments"}
              </Button>
            </div>

            <form
              className="rounded-lg border border-border p-4"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void updateSettings({ defaultProjectLimit: Number(data.get("defaultProjectLimit")) });
              }}
            >
              <label className="text-sm font-medium" htmlFor="defaultProjectLimit">Default project limit</label>
              <div className="mt-3 flex gap-2">
                <Input id="defaultProjectLimit" name="defaultProjectLimit" type="number" min={0} max={100} defaultValue={overview?.settings.defaultProjectLimit ?? 4} />
                <Button type="submit" disabled={saving}>Save</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-none">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">Search control plane</CardTitle>
              <CardDescription>Filter users and projects by email, name, repository, or subdomain.</CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-8" placeholder="Search admin data" />
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <Panel title="Users" count={users.length}>
              {users.map((user) => (
                <div key={user.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{user.email}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{user._count.projects} projects</p>
                    </div>
                    <Badge variant={user.role === "ADMIN" ? "secondary" : "outline"}>{user.role}</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => void updateUser(user, { role: user.role === "ADMIN" ? "USER" : "ADMIN" })}>
                      <ShieldCheck data-icon="inline-start" />
                      {user.role === "ADMIN" ? "Demote" : "Promote"}
                    </Button>
                    <LimitForm user={user} onSave={(limit) => void updateUser(user, { projectLimitOverride: limit })} />
                    <Button size="sm" variant="destructive" onClick={() => setConfirmAction({ kind: "delete-user", id: user.id, label: user.email })}>
                      <Trash2 data-icon="inline-start" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </Panel>

            <Panel title="Hosted websites" count={projects.length}>
              {projects.map((project) => (
                <div key={project.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{project.name}</p>
                      <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{project.subdomain}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{project.user.email}</p>
                    </div>
                    <Badge variant="outline">{project.activeDeploy?.status || "No deploy"}</Badge>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <Button size="sm" variant="ghost" render={<Link href={`/projects/${project.id}`} />}>Open</Button>
                    <Button size="sm" variant="destructive" onClick={() => setConfirmAction({ kind: "delete-project", id: project.id, label: project.name })}>
                      <Trash2 data-icon="inline-start" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </Panel>
          </CardContent>
        </Card>
      </section>

      <Card className="border-border bg-card shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Deployments</CardTitle>
          <CardDescription>Recent platform deployments with active build cancellation.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {deployments.map((deployment) => {
            const active = ["QUEUED", "BUILDING", "UPLOADING"].includes(deployment.status);
            return (
              <div key={deployment.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{deployment.project.name}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{deployment.project.user.email}</p>
                  </div>
                  <Badge variant={active ? "secondary" : "outline"}>{deployment.status}</Badge>
                </div>
                <p className="mt-3 font-mono text-xs text-muted-foreground">{deployment.commitSha.slice(0, 7)} · {deployment.triggerSource}</p>
                {active && (
                  <Button className="mt-4 w-full" size="sm" variant="destructive" onClick={() => setConfirmAction({ kind: "cancel-deployment", id: deployment.id, label: deployment.project.name })}>
                    <Ban data-icon="inline-start" />
                    Cancel deployment
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm admin action</AlertDialogTitle>
            <AlertDialogDescription>
              This action affects production data for {confirmAction?.label}. It cannot be undone from the dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void runConfirmedAction()}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <Card className="border-border bg-card shadow-none">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.04em]">{value}</p>
        </div>
        <span className="flex size-8 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
          <Icon />
        </span>
      </CardContent>
    </Card>
  );
}

function Panel({ children, count, title }: { children: React.ReactNode; count: number; title: string }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{title}</h2>
        <Badge variant="outline">{count}</Badge>
      </div>
      <div className="app-scroll flex max-h-[520px] flex-col gap-3 overflow-y-auto pr-1">
        {count ? children : <p className="rounded-lg border border-border px-4 py-8 text-center text-sm text-muted-foreground">No records found.</p>}
      </div>
    </section>
  );
}

function LimitForm({ onSave, user }: { onSave: (limit: number) => void; user: AdminUser }) {
  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSave(Number(data.get("limit")));
      }}
    >
      <Input className="h-8 w-20" name="limit" type="number" min={0} max={100} defaultValue={user.projectLimitOverride ?? ""} placeholder="Limit" />
      <Button size="sm" variant="outline" type="submit">Limit</Button>
    </form>
  );
}
