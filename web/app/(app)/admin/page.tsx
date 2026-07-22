"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Ban,
  Boxes,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  GitBranch,
  Globe2,
  LoaderCircle,
  Pause,
  Play,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useApiRequest } from "@/hooks/use-api";
import { siteUrl } from "@/lib/site-url";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
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
  activeDeploymentItems: AdminDeployment[];
  settings: PlatformSettings;
};

type AdminUser = {
  id: string;
  email: string;
  username?: string | null;
  role: "USER" | "ADMIN";
  projectLimitOverride?: number | null;
  createdAt: string;
  _count: { projects: number; githubConnections?: number };
};

type AdminProject = {
  id: string;
  name: string;
  subdomain: string;
  repoUrl: string;
  user: { email: string; username?: string | null };
  activeDeploy?: { status: string } | null;
  _count: { deployments: number; requestLogs?: number; customDomains: number };
};

type AdminDeployment = {
  id: string;
  status: string;
  commitSha: string;
  triggerSource: string;
  branch: string;
  deployedAt: string;
  project: { id: string; name: string; subdomain: string; user: { email: string } };
};

type ConfirmAction =
  | { kind: "delete-user"; id: string; label: string }
  | { kind: "delete-project"; id: string; label: string }
  | { kind: "cancel-deployment"; id: string; label: string };

const ACTIVE_DEPLOYMENT_STATUSES = ["QUEUED", "BUILDING", "UPLOADING"];
const PAGE_SIZE = 25;

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "SUCCESS") return "default";
  if (status === "FAILED" || status === "TIMEOUT") return "destructive";
  if (ACTIVE_DEPLOYMENT_STATUSES.includes(status)) return "secondary";
  return "outline";
}

export default function AdminPage() {
  const apiRequest = useApiRequest();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [deployments, setDeployments] = useState<AdminDeployment[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [projectTotal, setProjectTotal] = useState(0);
  const [deploymentTotal, setDeploymentTotal] = useState(0);
  const [userPage, setUserPage] = useState(0);
  const [projectPage, setProjectPage] = useState(0);
  const [deploymentPage, setDeploymentPage] = useState(0);
  const [searchDraft, setSearchDraft] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [defaultProjectLimit, setDefaultProjectLimit] = useState("4");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionRunning, setActionRunning] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    try {
      const userParams = new URLSearchParams({ take: String(PAGE_SIZE), skip: String(userPage * PAGE_SIZE) });
      const projectParams = new URLSearchParams({ take: String(PAGE_SIZE), skip: String(projectPage * PAGE_SIZE) });
      if (appliedSearch) {
        userParams.set("search", appliedSearch);
        projectParams.set("search", appliedSearch);
      }
      const deploymentParams = new URLSearchParams({ take: String(PAGE_SIZE), skip: String(deploymentPage * PAGE_SIZE) });
      const [overviewRes, usersRes, projectsRes, deploymentsRes] = await Promise.all([
        apiRequest("GET", "/admin/overview") as Promise<Overview>,
        apiRequest("GET", `/admin/users?${userParams.toString()}`) as Promise<{ users: AdminUser[]; total: number }>,
        apiRequest("GET", `/admin/projects?${projectParams.toString()}`) as Promise<{ projects: AdminProject[]; total: number }>,
        apiRequest("GET", `/admin/deployments?${deploymentParams.toString()}`) as Promise<{ deployments: AdminDeployment[]; total: number }>,
      ]);
      setOverview(overviewRes);
      setUsers(usersRes.users || []);
      setProjects(projectsRes.projects || []);
      setDeployments(deploymentsRes.deployments || []);
      setUserTotal(usersRes.total || 0);
      setProjectTotal(projectsRes.total || 0);
      setDeploymentTotal(deploymentsRes.total || 0);
      setDefaultProjectLimit(String(overviewRes.settings.defaultProjectLimit));
      setUpdatedAt(new Date());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load admin control plane");
    } finally {
      setLoading(false);
    }
  }, [apiRequest, appliedSearch, deploymentPage, projectPage, userPage]);

  useEffect(() => {
    document.title = "Admin | Kyte";
    const timer = setTimeout(() => void loadAdmin(), 0);
    return () => clearTimeout(timer);
  }, [loadAdmin]);

  const activeDeployments = useMemo(
    () => overview?.activeDeploymentItems || [],
    [overview?.activeDeploymentItems],
  );

  async function updateSettings(patch: Partial<PlatformSettings>) {
    setSaving(true);
    try {
      const settings = await apiRequest("PATCH", "/admin/settings", patch) as PlatformSettings;
      setOverview((current) => current ? { ...current, settings } : current);
      setDefaultProjectLimit(String(settings.defaultProjectLimit));
      toast.success("Platform settings updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update platform settings");
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(user: AdminUser, patch: { role?: "USER" | "ADMIN"; projectLimitOverride?: number | null }) {
    setActionRunning(true);
    try {
      await apiRequest("PATCH", `/admin/users/${user.id}`, patch);
      toast.success(`Updated ${user.email}`);
      await loadAdmin();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update user");
    } finally {
      setActionRunning(false);
    }
  }

  async function runConfirmedAction() {
    if (!confirmAction) return;
    setActionRunning(true);
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
      toast.error(error instanceof Error ? error.message : "Admin action failed");
    } finally {
      setActionRunning(false);
    }
  }

  if (loading && !overview) return <AdminLoading />;

  const deploymentsPaused = overview?.settings.deploymentsPaused ?? false;

  return (
    <div className="app-page flex min-h-full max-w-[1600px] flex-col gap-8 py-10">
      <header className="flex flex-col gap-5 border-b border-border pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2">
            <Badge variant="outline"><ShieldCheck />Administrator</Badge>
            <Badge variant={deploymentsPaused ? "destructive" : "secondary"}>
              {deploymentsPaused ? "Build intake paused" : "Platform operational"}
            </Badge>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">Platform control plane</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Operate accounts, hosted sites, deployment intake, and platform limits from one protected workspace.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[11px] text-muted-foreground">
            {updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Not refreshed"}
          </span>
          <Button variant="outline" render={<Link href="/dashboard" />}>Back to workspace</Button>
          <Button onClick={() => void loadAdmin()} disabled={loading}>
            {loading ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
            Refresh data
          </Button>
        </div>
      </header>

      <Card className="overflow-hidden shadow-none">
        <CardHeader className="gap-5 border-b border-border bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground">
              {deploymentsPaused ? <Pause /> : <Activity />}
            </span>
            <div>
              <CardTitle className="text-lg">Build intake is {deploymentsPaused ? "paused" : "open"}</CardTitle>
              <CardDescription className="mt-2 max-w-2xl leading-6">
                {deploymentsPaused
                  ? "New manual and webhook deployments are blocked. Builds already running continue until canceled."
                  : "New manual and webhook deployments can enter the build queue normally."}
              </CardDescription>
            </div>
          </div>
          <Button
            variant={deploymentsPaused ? "default" : "destructive"}
            disabled={saving}
            onClick={() => void updateSettings({ deploymentsPaused: !deploymentsPaused })}
          >
            {saving ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : deploymentsPaused ? <Play data-icon="inline-start" /> : <Pause data-icon="inline-start" />}
            {deploymentsPaused ? "Resume deployments" : "Pause new deployments"}
          </Button>
        </CardHeader>
        <CardContent className="grid gap-6 pt-6 md:grid-cols-[minmax(0,1fr)_320px] md:items-end">
          <div>
            <p className="text-sm font-medium">Maintenance procedure</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Pause intake before maintenance, inspect active builds in Deployments, cancel only jobs that cannot safely finish, and resume intake after worker health checks pass.</p>
          </div>
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void updateSettings({ defaultProjectLimit: Number(defaultProjectLimit) });
            }}
          >
            <label className="flex flex-1 flex-col gap-2 text-sm font-medium" htmlFor="defaultProjectLimit">
              Default projects per user
              <Input id="defaultProjectLimit" type="number" min={0} max={100} value={defaultProjectLimit} onChange={(event) => setDefaultProjectLimit(event.target.value)} />
            </label>
            <Button type="submit" variant="outline" disabled={saving || defaultProjectLimit === ""}>Save limit</Button>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Platform summary">
        <MetricCard icon={Users} label="Accounts" value={overview?.users ?? 0} detail="Registered users" />
        <MetricCard icon={Globe2} label="Hosted sites" value={overview?.projects ?? 0} detail="Across all accounts" />
        <MetricCard icon={Boxes} label="Deployments" value={overview?.deployments ?? 0} detail="Lifetime builds" />
        <MetricCard icon={Activity} label="Active queue" value={overview?.activeDeployments ?? activeDeployments.length} detail="Queued or running" />
      </section>

      <form
        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          const nextSearch = searchDraft.trim();
          setUserPage(0);
          setProjectPage(0);
          if (nextSearch === appliedSearch) void loadAdmin();
          else setAppliedSearch(nextSearch);
        }}
      >
        <Search className="hidden shrink-0 text-muted-foreground sm:block" />
        <Input
          aria-label="Search users and hosted sites"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          placeholder="Search email, user, site, repository, or subdomain"
        />
        <Button type="submit" variant="outline">Search records</Button>
        {appliedSearch && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearchDraft("");
              setUserPage(0);
              setProjectPage(0);
              setAppliedSearch("");
            }}
          >
            Clear
          </Button>
        )}
      </form>

      <Tabs defaultValue="overview" className="gap-6">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto border-b border-border pb-3">
          <TabsTrigger value="overview"><Settings2 data-icon="inline-start" />Overview</TabsTrigger>
          <TabsTrigger value="users"><Users data-icon="inline-start" />Users <Badge variant="outline">{userTotal}</Badge></TabsTrigger>
          <TabsTrigger value="sites"><Globe2 data-icon="inline-start" />Hosted sites <Badge variant="outline">{projectTotal}</Badge></TabsTrigger>
          <TabsTrigger value="deployments"><Boxes data-icon="inline-start" />Deployments <Badge variant="outline">{deploymentTotal}</Badge></TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Active build queue</CardTitle>
              <CardDescription>Jobs that may need attention before maintenance or a worker restart.</CardDescription>
            </CardHeader>
            <CardContent>
              {activeDeployments.length ? (
                <div className="flex flex-col gap-3">
                  {activeDeployments.map((deployment) => (
                    <div key={deployment.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium">{deployment.project.name}</p>
                          <Badge variant={statusVariant(deployment.status)}>{deployment.status}</Badge>
                        </div>
                        <p className="mt-2 truncate text-xs text-muted-foreground">{deployment.project.user.email} · {deployment.commitSha.slice(0, 7)}</p>
                      </div>
                      <Button size="sm" variant="destructive" disabled={actionRunning} onClick={() => setConfirmAction({ kind: "cancel-deployment", id: deployment.id, label: deployment.project.name })}>
                        <Ban data-icon="inline-start" />Cancel build
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={CheckCircle2} title="Build queue is clear" description="No deployments are queued, building, or uploading." />
              )}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Operator notes</CardTitle>
              <CardDescription>Guardrails for production actions.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              <OperatorNote number="01" title="Pause before maintenance" detail="Stops new deployment intake without terminating active jobs." />
              <OperatorNote number="02" title="Inspect ownership" detail="Confirm the account and repository before deleting a hosted site." />
              <OperatorNote number="03" title="Delete with intent" detail="User and project deletion removes related deployment data and cannot be undone here." />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <DataCard title="User administration" description="Manage access level, GitHub connection visibility, project allowances, and account deletion." count={users.length} total={userTotal} page={userPage} onPageChange={setUserPage}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Project allowance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="min-w-64 whitespace-normal py-4">
                      <p className="font-medium">{user.username || "Unnamed user"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{user.email}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Joined {formatDate(user.createdAt)}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-2">
                        <Badge variant={user.role === "ADMIN" ? "secondary" : "outline"}>{user.role}</Badge>
                        <span className="text-xs text-muted-foreground">{user._count.githubConnections ? "GitHub connected" : "No GitHub connection"}</span>
                      </div>
                    </TableCell>
                    <TableCell>{user._count.projects} projects</TableCell>
                    <TableCell>
                      <UserLimitControl
                        key={`${user.id}-${user.projectLimitOverride ?? "default"}`}
                        disabled={actionRunning}
                        defaultLimit={overview?.settings.defaultProjectLimit ?? 4}
                        user={user}
                        onSave={(limit) => void updateUser(user, { projectLimitOverride: limit })}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" disabled={actionRunning} onClick={() => void updateUser(user, { role: user.role === "ADMIN" ? "USER" : "ADMIN" })}>
                          <ShieldCheck data-icon="inline-start" />{user.role === "ADMIN" ? "Demote" : "Promote"}
                        </Button>
                        <Button size="icon-sm" variant="destructive" title={`Delete ${user.email}`} disabled={actionRunning} onClick={() => setConfirmAction({ kind: "delete-user", id: user.id, label: user.email })}>
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!users.length && <EmptyState icon={Users} title="No users found" description="Change or clear the search to see accounts." />}
          </DataCard>
        </TabsContent>

        <TabsContent value="sites">
          <DataCard title="Hosted websites" description="Inspect ownership, deployment state, domains, request volume, and project removal." count={projects.length} total={projectTotal} page={projectPage} onPageChange={setProjectPage}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Website</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Platform activity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="min-w-72 whitespace-normal py-4">
                      <p className="font-medium">{project.name}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{project.subdomain}</p>
                      <p className="mt-1 max-w-80 truncate text-xs text-muted-foreground">{project.repoUrl}</p>
                    </TableCell>
                    <TableCell>
                      <p>{project.user.username || project.user.email}</p>
                      {project.user.username && <p className="mt-1 text-xs text-muted-foreground">{project.user.email}</p>}
                    </TableCell>
                    <TableCell><Badge variant={statusVariant(project.activeDeploy?.status || "NONE")}>{project.activeDeploy?.status || "No deployment"}</Badge></TableCell>
                    <TableCell>
                      <p>{project._count.deployments} deployments</p>
                      <p className="mt-1 text-xs text-muted-foreground">{project._count.customDomains} custom domains · {project._count.requestLogs ?? 0} tracked views</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button size="icon-sm" variant="ghost" title="Open project" render={<Link href={`/projects/${project.id}`} />}><ExternalLink /></Button>
                        <Button size="icon-sm" variant="ghost" title="Visit website" render={<a href={siteUrl(project.subdomain)} target="_blank" rel="noreferrer" />}><Globe2 /></Button>
                        <Button size="icon-sm" variant="destructive" title={`Delete ${project.name}`} disabled={actionRunning} onClick={() => setConfirmAction({ kind: "delete-project", id: project.id, label: project.name })}><Trash2 /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!projects.length && <EmptyState icon={Globe2} title="No hosted sites found" description="Change or clear the search to see projects." />}
          </DataCard>
        </TabsContent>

        <TabsContent value="deployments">
          <DataCard title="Deployment history" description="Review build history and cancel jobs that are still active." count={deployments.length} total={deploymentTotal} page={deploymentPage} onPageChange={setDeploymentPage}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deployment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deployments.map((deployment) => {
                  const active = ACTIVE_DEPLOYMENT_STATUSES.includes(deployment.status);
                  return (
                    <TableRow key={deployment.id}>
                      <TableCell className="min-w-64 whitespace-normal py-4">
                        <p className="font-medium">{deployment.project.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{deployment.project.user.email}</p>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">{deployment.commitSha.slice(0, 7)}</p>
                      </TableCell>
                      <TableCell><Badge variant={statusVariant(deployment.status)}>{deployment.status}</Badge></TableCell>
                      <TableCell>
                        <p>{deployment.triggerSource}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><GitBranch />{deployment.branch}</p>
                      </TableCell>
                      <TableCell>{formatDate(deployment.deployedAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" render={<Link href={`/projects/${deployment.project.id}`} />}>Inspect</Button>
                          {active && (
                            <Button size="sm" variant="destructive" disabled={actionRunning} onClick={() => setConfirmAction({ kind: "cancel-deployment", id: deployment.id, label: deployment.project.name })}>
                              <Ban data-icon="inline-start" />Cancel
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {!deployments.length && <EmptyState icon={Boxes} title="No deployments found" description="Deployment history will appear here." />}
          </DataCard>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && !actionRunning && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia><CircleAlert /></AlertDialogMedia>
            <AlertDialogTitle>Confirm production action</AlertDialogTitle>
            <AlertDialogDescription>This action affects production data for {confirmAction?.label}. Deleting an account or project cannot be undone from Kyte.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionRunning}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={actionRunning} onClick={() => void runConfirmedAction()}>
              {actionRunning && <LoaderCircle className="animate-spin" data-icon="inline-start" />}
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AdminLoading() {
  return (
    <div className="app-page flex max-w-[1600px] flex-col gap-8 py-10">
      <div className="flex flex-col gap-3"><Skeleton className="h-6 w-36" /><Skeleton className="h-11 w-80 max-w-full" /><Skeleton className="h-5 w-[520px] max-w-full" /></div>
      <Skeleton className="h-48 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32" />)}</div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Users; label: string; value: number; detail: string }) {
  return (
    <Card className="shadow-none">
      <CardHeader className="flex-row items-start justify-between pb-3">
        <div><CardDescription>{label}</CardDescription><CardTitle className="mt-3 text-3xl tracking-[-0.04em]">{value.toLocaleString()}</CardTitle></div>
        <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground"><Icon /></span>
      </CardHeader>
      <CardFooter><p className="text-xs text-muted-foreground">{detail}</p></CardFooter>
    </Card>
  );
}

function DataCard({ children, count, description, onPageChange, page, title, total }: { children: React.ReactNode; count: number; description: string; onPageChange: (page: number) => void; page: number; title: string; total: number }) {
  const firstRecord = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const lastRecord = Math.min(total, page * PAGE_SIZE + count);
  return (
    <Card className="overflow-hidden shadow-none">
      <CardHeader className="border-b border-border sm:flex-row sm:items-start sm:justify-between">
        <div><CardTitle>{title}</CardTitle><CardDescription className="mt-2">{description}</CardDescription></div>
        <Badge variant="outline">Showing {count} of {total}</Badge>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
      <CardFooter className="justify-between gap-4 border-t border-border bg-muted/20 pt-4">
        <p className="text-xs text-muted-foreground">Records {firstRecord}–{lastRecord} of {total}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => onPageChange(page - 1)}>Previous</Button>
          <Button size="sm" variant="outline" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => onPageChange(page + 1)}>Next</Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function EmptyState({ description, icon: Icon, title }: { description: string; icon: typeof Users; title: string }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
      <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground"><Icon /></span>
      <p className="mt-4 text-sm font-medium">{title}</p>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function OperatorNote({ detail, number, title }: { detail: string; number: string; title: string }) {
  return (
    <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 border-b border-border pb-4 last:border-0 last:pb-0">
      <span className="font-mono text-xs text-muted-foreground">{number}</span>
      <div><p className="font-medium">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div>
    </div>
  );
}

function UserLimitControl({ defaultLimit, disabled, onSave, user }: { defaultLimit: number; disabled: boolean; onSave: (limit: number | null) => void; user: AdminUser }) {
  const [value, setValue] = useState(user.projectLimitOverride === null || user.projectLimitOverride === undefined ? "" : String(user.projectLimitOverride));
  return (
    <div className="flex min-w-52 flex-col gap-2">
      <div className="flex gap-2">
        <Input aria-label={`Project limit for ${user.email}`} className="w-20" type="number" min={0} max={100} value={value} placeholder={String(defaultLimit)} onChange={(event) => setValue(event.target.value)} />
        <Button size="sm" variant="outline" disabled={disabled || value === ""} onClick={() => onSave(Number(value))}>Save</Button>
      </div>
      <button type="button" className="w-fit text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50" disabled={disabled || user.projectLimitOverride == null} onClick={() => onSave(null)}>Use platform default ({defaultLimit})</button>
    </div>
  );
}
