"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useApiRequest, useApiToken } from '@/hooks/use-api';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Copy, Download, ExternalLink, FileText, GitBranch, GitCommitHorizontal, Clock, ChevronRight, Globe, RefreshCw, Search, Activity, Users, Gauge, Timer, MapPinned, CircleCheck, CircleX, ArrowUpRight, Radio, Server, Zap, Webhook } from 'lucide-react';
import Link from 'next/link';
import { ProjectAvatar } from '@/components/project-avatar';
import { EnvironmentVariableEditor } from '@/components/environment-variable-editor';
import { streamDeploymentLogs } from '@/lib/deployment-log-stream';
import { DomainManager } from '@/components/domain-manager';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { siteHostname, siteUrl } from '@/lib/site-url';



interface Project {
  id: string;
  name: string;
  repoUrl: string;
  preset: string;
  rootDirectory: string;
  buildCommand: string;
  outputDirectory: string;
  branch: string;
  subdomain?: string;
  webhookId?: string;
}

interface Deployment {
  id: string;
  status: string;
  commitSha: string;
  deployedAt: string;
  branch?: string;
  triggerSource?: string;
  commitMessage?: string;
  updatedAt: string;
}

interface SettingsForm {
  name: string;
  branch: string;
  rootDirectory: string;
  buildCommand: string;
  outputDirectory: string;
}

interface WebhookStatus {
  enabled: boolean;
  provider: 'github';
  repository: string;
  branch: string;
  limit: number;
  canEnable: boolean;
}

interface ProjectMetrics {
  pageviews: number
  visitors: number
  avgResponse: number
  avgBuild: number
  health: number
  successfulDeployments: number
  failedDeployments: number
  totalDeployments: number
  trafficData: { day: string; pageviews: number; visitors: number }[]
  locations: { country: string; code: string; visitors: string; share: number }[]
}

function formatRelativeTime(value?: string) {
  if (!value) return 'No deployments yet';
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'Deployed just now';
  if (minutes < 60) return `Deployed ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Deployed ${hours}h ago`;
  return `Deployed ${Math.floor(hours / 24)}d ago`;
}

export default function ProjectPage() {
  useEffect(() => { document.title = "Project | Kyte"; }, []);
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const apiRequest = useApiRequest();
  const getClerkToken = useApiToken();

  const [project, setProject] = useState<Project | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [activeDeploy, setActiveDeploy] = useState<Deployment | null>(null);
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null);
  const [logs, setLogs] = useState<{ stream: string; text: string }[]>([]);
  const [logQuery, setLogQuery] = useState('');
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<string>("Overview");
  const [overviewSeries, setOverviewSeries] = useState<'pageviews' | 'visitors'>('pageviews');

  const [settingsForm, setSettingsForm] = useState<SettingsForm>({
    name: '', branch: '', rootDirectory: '', buildCommand: '', outputDirectory: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [envVars, setEnvVars] = useState<{key: string, value: string}[]>([]);
  const [isSavingEnv, setIsSavingEnv] = useState(false);
  const [hasEnvChanges, setHasEnvChanges] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus | null>(null);
  const [webhookAction, setWebhookAction] = useState<'enable' | 'disable' | null>(null);

  const copyLogs = async () => {
    await navigator.clipboard.writeText(logs.map((log) => log.text).join(''));
  };

  const downloadLogs = () => {
    const blob = new Blob([logs.map((log) => log.text).join('')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${project?.name || 'deployment'}-${activeDeploy?.commitSha?.slice(0, 7) || 'logs'}.log`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const loadData = useCallback(async () => {
    try {
      const proj = await apiRequest('GET', `/projects`);
      const found = proj.projects.find((p: Project) => p.id === projectId);
      setProject(found);
      setWebhookStatus({
        enabled: Boolean(found.webhookId),
        provider: 'github',
        repository: found.repoUrl,
        branch: found.branch || 'main',
        limit: 1,
        canEnable: true,
      });
      const webhook = await apiRequest('GET', `/projects/${projectId}/webhook`).catch(() => null);
      if (webhook) setWebhookStatus(webhook);

      setSettingsForm((prev: SettingsForm) => ({
        name: prev.name || found.name || '',
        branch: prev.branch || found.branch || '',
        rootDirectory: prev.rootDirectory || found.rootDirectory || '',
        buildCommand: prev.buildCommand || found.buildCommand || '',
        outputDirectory: prev.outputDirectory || found.outputDirectory || '',
      }));

      const deps = await apiRequest('GET', `/projects/${projectId}/deployments`);
      setDeployments(deps.deployments || []);
      if (deps.deployments.length > 0) {
        setActiveDeploy((prev: Deployment | null) => prev ? prev : deps.deployments[0]);
      }

      const metricsData = await apiRequest('GET', `/projects/${projectId}/metrics`).catch(() => null);
      if (metricsData) setMetrics(metricsData);
      
      const envData = await apiRequest('GET', `/projects/${projectId}/env`).catch(() => []);
      if (Array.isArray(envData) && !hasEnvChanges) {
        setEnvVars(envData.length ? envData : [{ key: "", value: "" }]);
      }
    } catch (err) { console.error(err); }
  }, [apiRequest, hasEnvChanges, projectId]);

  useEffect(() => {
    const timer = setTimeout(() => { void loadData(); }, 0);
    const interval = setInterval(() => { void loadData(); }, 5000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [loadData]);

  useEffect(() => {
    if (activeTab === "Logs") {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);

  const triggerDeploy = async () => {
    try {
      if (!project) return;
      const res = await apiRequest('POST', `/projects/${projectId}/deployments`, {
        commitSha: 'HEAD',
      });
      setActiveDeploy(res);
      setLogs([]);
      setActiveTab("Logs");
      void loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to trigger deployment');
    }
  };

  const enableWebhook = async () => {
    setWebhookAction('enable');
    try {
      const status = await apiRequest('POST', `/projects/${projectId}/webhook/enable`);
      setWebhookStatus(status);
      toast.success(status.message || 'Automatic deployments enabled');
      void loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to enable automatic deployments');
    }
    finally { setWebhookAction(null); }
  };

  const disableWebhook = async () => {
    setWebhookAction('disable');
    try {
      const status = await apiRequest('DELETE', `/projects/${projectId}/webhook`);
      setWebhookStatus(status);
      toast.success(status.message || 'Automatic deployments disabled');
      void loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disable automatic deployments');
    } finally {
      setWebhookAction(null);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      await apiRequest('PATCH', `/projects/${projectId}`, settingsForm);
      alert('Settings saved successfully!');
      void loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const saveEnvVars = async () => {
    setIsSavingEnv(true);
    try {
      await apiRequest('POST', `/projects/${projectId}/env`, { variables: envVars.filter(e => e.key.trim()) });
      alert('Environment variables saved successfully!');
      setHasEnvChanges(false);
      void loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save environment variables');
    }
    finally { setIsSavingEnv(false); }
  };

  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  const deleteProject = async () => {
    try {
      await apiRequest('DELETE', `/projects/${projectId}`);
      router.push('/dashboard');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  useEffect(() => {
    if (!activeDeploy?.id) return;
    const controller = new AbortController();
    (async () => {
      const token = await getClerkToken();
      if (!token) return;
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost/api';
      await streamDeploymentLogs(
        `${API_BASE}/projects/${projectId}/deployments/${activeDeploy.id}/logs`,
        token,
        (data) => {
          setLogs(prev => [...prev, data]);
          if (data.text.includes('Deploy complete.') || data.text.includes('Build failed:')) {
            void loadData();
          }
        },
        controller.signal,
      );
    })().catch(() => {});
    return () => controller.abort();
  }, [activeDeploy?.id, getClerkToken, loadData, projectId]);

  if (!project) return <div className="app-page py-24 text-center text-muted-foreground animate-pulse">Loading project…</div>;

  const tabs = ["Overview", "Observability", "Deployments", "Logs", "Domains", "Settings"];

  const renderStatusBadge = (status: string) => {
    const label = status === 'SUCCESS' ? 'Ready' : status === 'FAILED' ? 'Failed' : status === 'BUILDING' ? 'Building' : status === 'UPLOADING' ? 'Uploading' : 'Queued';
    const dotColor = status === 'SUCCESS' ? 'bg-emerald-500' : status === 'FAILED' ? 'bg-red-500' : status === 'BUILDING' || status === 'UPLOADING' ? 'bg-amber-400 animate-pulse' : 'bg-zinc-400';
    const textColor = status === 'SUCCESS' ? 'text-emerald-400' : status === 'FAILED' ? 'text-red-400' : status === 'BUILDING' || status === 'UPLOADING' ? 'text-amber-300' : 'text-zinc-300';
    const borderColor = status === 'SUCCESS' ? 'border-emerald-500/30' : status === 'FAILED' ? 'border-red-500/30' : status === 'BUILDING' || status === 'UPLOADING' ? 'border-amber-500/30' : 'border-zinc-700';
    return <Badge variant="outline" className={`gap-2 bg-zinc-900 font-normal ${textColor} ${borderColor}`}><span className={`size-1.5 rounded-full ${dotColor}`} />{label}</Badge>;
  };

  const currentDeployStatus = activeDeploy?.status || 'UNKNOWN';
  const metricLocations = metrics?.locations ?? [];
  const overviewData = metrics?.trafficData ?? [];
  const overviewMetric = overviewSeries === 'pageviews' ? metrics?.pageviews ?? 0 : metrics?.visitors ?? 0;
  const overviewMetricLabel = overviewSeries === 'pageviews' ? 'Pageviews' : 'Visitors';
  const deploymentHealth = metrics?.health ?? 100;
  return (
    <div className="min-h-full w-full bg-background text-foreground">
      {/* Top Navbar */}
      <div className="flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-md sm:px-6 md:px-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <SidebarTrigger className="-ml-1 mr-1" />
          <span className="h-4 w-px bg-border" />
          <Link href="/dashboard" className="flex items-center gap-2 hover:text-foreground transition-colors cursor-pointer">
            <span className="font-medium text-foreground">Projects</span>
          </Link>
          <ChevronRight className="w-4 h-4" />
          <div className="flex items-center gap-2 font-medium text-foreground">
            {project.name}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={triggerDeploy} variant="outline" size="sm">
            <RefreshCw data-icon="inline-start" /> Redeploy
          </Button>
          <a href={siteUrl(project.subdomain || '')} target="_blank" rel="noreferrer">
            <Button size="sm">
              <ExternalLink data-icon="inline-start" /> Visit
            </Button>
          </a>
        </div>
      </div>

      <div className="app-page flex min-h-0 flex-1 flex-col gap-7 pb-12 pt-7">
        <section className="flex flex-col gap-5 border-b border-border pb-6">
          <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="p-1 rounded-lg border border-border/60 shrink-0 bg-card shadow-sm">
                  <ProjectAvatar projectId={project.id} size={48} className="rounded-md" />
                </div>
                <h1 className="text-2xl font-semibold tracking-[-0.035em] text-foreground sm:text-3xl">{project.name}</h1>
                {renderStatusBadge(deployments[0]?.status || 'QUEUED')}
                <Badge variant="outline" className="font-mono font-normal">{project.preset || 'Other'}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <a href={siteUrl(project.subdomain || '')} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-foreground transition-colors">
                  <Globe className="size-3.5" />
                  {siteHostname(project.subdomain || '')} <ExternalLink className="size-3" />
                </a>
                <div className="flex items-center gap-2">
                  <GitBranch className="size-3.5" /> {project.branch || 'main'}
                </div>
                {activeDeploy && (
                  <div className="flex items-center gap-2 font-mono">
                    <GitCommitHorizontal className="size-3.5" />{activeDeploy.commitSha?.slice(0, 7)}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Clock className="size-3.5" /> {deployments.length > 0 ? `Deployed ${new Date(deployments[0].deployedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'Not deployed'}
                </div>
              </div>
          </div>
        </section>

        {/* Tabs */}
        <div className="-mb-px flex w-full shrink-0 items-center gap-5 overflow-x-auto border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative flex items-center gap-2 whitespace-nowrap pb-4 text-sm font-medium transition-colors ${
                activeTab === tab ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-primary" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content Wrapper */}
        <div className="mt-4 flex-1 flex flex-col min-h-0 w-full overflow-hidden">
          {activeTab === "Overview" && (
            <div className="flex w-full flex-col gap-5 overflow-y-auto pb-8">
              <section className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="flex flex-col gap-4 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border ${currentDeployStatus === 'SUCCESS' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400' : currentDeployStatus === 'FAILED' ? 'border-red-500/25 bg-red-500/10 text-red-400' : 'border-amber-500/25 bg-amber-500/10 text-amber-300'}`}>
                      <Radio className="size-4" />
                    </div>
                    <div>
                      <p className="section-label">Production pulse</p>
                      <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em]">{currentDeployStatus === 'SUCCESS' ? 'Everything is serving normally' : currentDeployStatus === 'FAILED' ? 'Your latest deployment needs attention' : 'A deployment is moving through production'}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(activeDeploy?.deployedAt)} · {activeDeploy?.triggerSource === 'WEBHOOK' ? 'Triggered by a Git push' : 'Triggered manually'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setActiveTab('Deployments')}>Deployment history<ChevronRight data-icon="inline-end" /></Button>{renderStatusBadge(currentDeployStatus)}</div>
                </div>
                <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                  <button type="button" onClick={() => setActiveTab('Observability')} className="group px-5 py-4 text-left transition-colors hover:bg-muted/40"><div className="flex items-center justify-between"><span className="section-label">Availability</span><ArrowUpRight className="size-3.5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div><p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{deploymentHealth}<span className="ml-1 text-sm font-medium text-muted-foreground">%</span></p><p className="mt-1 text-xs text-muted-foreground">Deployment success rate</p></button>
                  <button type="button" onClick={() => setActiveTab('Observability')} className="group px-5 py-4 text-left transition-colors hover:bg-muted/40"><div className="flex items-center justify-between"><span className="section-label">Response time</span><ArrowUpRight className="size-3.5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div><p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{metrics?.avgResponse || 0}<span className="ml-1 text-sm font-medium text-muted-foreground">ms</span></p><p className="mt-1 text-xs text-muted-foreground">Average visitor response</p></button>
                  <button type="button" onClick={() => setActiveTab('Observability')} className="group px-5 py-4 text-left transition-colors hover:bg-muted/40"><div className="flex items-center justify-between"><span className="section-label">Visitors</span><ArrowUpRight className="size-3.5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div><p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{metrics?.visitors?.toLocaleString() || 0}</p><p className="mt-1 text-xs text-muted-foreground">Unique visitors this week</p></button>
                </div>
              </section>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
                <section className="overflow-hidden rounded-lg border border-border bg-card xl:col-span-8">
                  <div className="flex flex-col gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div><p className="section-label">Production traffic</p><div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1"><h3 className="text-xl font-semibold tracking-[-0.03em]">{overviewMetric.toLocaleString()}</h3><span className="text-xs text-muted-foreground">{overviewMetricLabel} in the last 7 days</span></div></div>
                    <div className="flex items-center rounded-md border border-border bg-muted/30 p-0.5" aria-label="Traffic chart metric"><button type="button" aria-pressed={overviewSeries === 'pageviews'} onClick={() => setOverviewSeries('pageviews')} className={`h-7 rounded px-2.5 text-xs transition-colors ${overviewSeries === 'pageviews' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Pageviews</button><button type="button" aria-pressed={overviewSeries === 'visitors'} onClick={() => setOverviewSeries('visitors')} className={`h-7 rounded px-2.5 text-xs transition-colors ${overviewSeries === 'visitors' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Visitors</button></div>
                  </div>
                  <div className="h-[290px] px-2 pb-2 pt-5 sm:h-[330px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={overviewData} margin={{ top: 8, right: 18, left: -14, bottom: 0 }}>
                        <defs><linearGradient id="overview-traffic" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} /><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
                        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 4" />
                        <XAxis axisLine={false} dataKey="day" tick={{ fill: '#71717a', fontSize: 11 }} tickLine={false} dy={8} />
                        <YAxis axisLine={false} tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={(value) => value >= 1000 ? `${Math.round(value / 1000)}k` : value} tickLine={false} />
                        <Tooltip cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '3 3' }} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }} labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: 4 }} formatter={(value) => [Number(value ?? 0).toLocaleString(), overviewMetricLabel]} />
                        <Area type="monotone" dataKey={overviewSeries} stroke="hsl(var(--primary))" strokeWidth={2.25} fill="url(#overview-traffic)" activeDot={{ r: 4, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-muted-foreground"><span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-zinc-200" />Interactive 7-day traffic</span><button type="button" onClick={() => setActiveTab('Observability')} className="flex items-center gap-1 font-medium text-foreground hover:text-muted-foreground">Open observability <ChevronRight className="size-3.5" /></button></div>
                </section>

                <aside className="overflow-hidden rounded-lg border border-border bg-card xl:col-span-4">
                  <div className="border-b border-border px-5 py-4"><p className="section-label">Live deployment</p><div className="mt-2 flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-mono text-sm text-foreground">{activeDeploy?.commitSha?.slice(0, 7) || 'No active commit'}</p><p className="mt-1 truncate text-xs text-muted-foreground">{activeDeploy?.commitMessage || 'Deploy a project to populate source details.'}</p></div><GitCommitHorizontal className="size-4 shrink-0 text-muted-foreground" /></div></div>
                  <div className="divide-y divide-border">
                    <div className="flex items-center gap-3 px-5 py-4"><div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground"><GitBranch className="size-3.5" /></div><div className="min-w-0"><p className="text-xs text-muted-foreground">Production branch</p><p className="mt-1 truncate font-mono text-xs text-foreground">{project.branch || 'main'}</p></div></div>
                    <div className="flex items-center gap-3 px-5 py-4"><div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground"><Zap className="size-3.5" /></div><div className="min-w-0"><p className="text-xs text-muted-foreground">Build command</p><p className="mt-1 truncate font-mono text-xs text-foreground">{project.buildCommand || 'npm run build'}</p></div></div>
                    <div className="flex items-center gap-3 px-5 py-4"><div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground"><Server className="size-3.5" /></div><div className="min-w-0"><p className="text-xs text-muted-foreground">Output directory</p><p className="mt-1 truncate font-mono text-xs text-foreground">{project.outputDirectory || 'dist'}</p></div></div>
                  </div>
                  <div className="border-t border-border bg-muted/20 px-5 py-3"><Button variant="ghost" size="sm" className="-ml-2" onClick={() => setActiveTab('Deployments')}>Inspect deployment<ChevronRight data-icon="inline-end" /></Button></div>
                </aside>
              </div>

            </div>
          )}
          {activeTab === "Observability" && (
            <div className="flex w-full flex-col gap-5 overflow-y-auto pb-8">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-[-0.02em]">Observability</h2>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">A simple view of how your project is performing in production.</p>
                </div>
                <span className="font-mono text-[11px] text-zinc-500">Last 7 days · Updated just now</span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between"><span className="section-label">Pageviews</span><Activity className="size-3.5 text-zinc-500" /></div>
                  <p className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{metrics?.pageviews?.toLocaleString() || 0}</p>
                  <p className="mt-1 text-xs text-emerald-400">Live <span className="text-muted-foreground">data tracking</span></p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between"><span className="section-label">Unique visitors</span><Users className="size-3.5 text-zinc-500" /></div>
                  <p className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{metrics?.visitors?.toLocaleString() || 0}</p>
                  <p className="mt-1 text-xs text-emerald-400">Live <span className="text-muted-foreground">data tracking</span></p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between"><span className="section-label">Avg. response</span><Gauge className="size-3.5 text-zinc-500" /></div>
                  <p className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{metrics?.avgResponse || 0}<span className="ml-1 text-sm font-medium text-muted-foreground">ms</span></p>
                  <p className="mt-1 text-xs text-muted-foreground">Fast for your visitors</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between"><span className="section-label">Avg. build</span><Timer className="size-3.5 text-zinc-500" /></div>
                  <p className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{metrics?.avgBuild || 0}<span className="ml-1 text-sm font-medium text-muted-foreground">s</span></p>
                  <p className="mt-1 text-xs text-muted-foreground">Across recent deployments</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
                <section className="overflow-hidden rounded-lg border border-border bg-card xl:col-span-8">
                  <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <div><h3 className="text-sm font-medium">Traffic</h3><p className="mt-1 text-xs text-muted-foreground">Pageviews and visitors over the past seven days.</p></div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground"><span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-zinc-200" />Pageviews</span><span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-zinc-600" />Visitors</span></div>
                  </div>
                  <div className="h-[280px] px-2 pb-3 pt-5">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={metrics?.trafficData || []} margin={{ top: 5, right: 12, left: -16, bottom: 0 }}>
                        <defs>
                          <linearGradient id="pageviews" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#e4e4e7" stopOpacity={0.18} /><stop offset="100%" stopColor="#e4e4e7" stopOpacity={0} /></linearGradient>
                          <linearGradient id="visitors" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#71717a" stopOpacity={0.18} /><stop offset="100%" stopColor="#71717a" stopOpacity={0} /></linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="#27272a" strokeDasharray="3 3" />
                        <XAxis axisLine={false} dataKey="day" tick={{ fill: '#71717a', fontSize: 11 }} tickLine={false} />
                        <YAxis axisLine={false} tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={(value) => `${value / 1000}k`} tickLine={false} />
                        <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }} cursor={{ stroke: '#52525b' }} labelStyle={{ color: '#a1a1aa' }} />
                        <Area dataKey="pageviews" fill="url(#pageviews)" stroke="#e4e4e7" strokeWidth={2} type="monotone" />
                        <Area dataKey="visitors" fill="url(#visitors)" stroke="#71717a" strokeWidth={2} type="monotone" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="overflow-hidden rounded-lg border border-border bg-card xl:col-span-4">
                  <div className="flex items-center gap-2 border-b border-border px-5 py-4"><MapPinned className="size-3.5 text-zinc-500" /><div><h3 className="text-sm font-medium">Traffic location</h3><p className="mt-1 text-xs text-muted-foreground">Where your visitors are coming from.</p></div></div>
                  <div className="divide-y divide-border px-5 py-1">
                    {metricLocations.length > 0 ? metricLocations.map((location) => (
                      <div key={location.country} className="py-3">
                        <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-zinc-300"><span className="flex size-5 items-center justify-center rounded bg-zinc-900 font-mono text-[9px] text-zinc-500">{location.code}</span>{location.country}</span><span className="font-mono text-zinc-500">{location.share}%</span></div>
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-900"><div className="h-full rounded-full bg-zinc-500" style={{ width: `${location.share}%` }} /></div>
                      </div>
                    )) : (
                      <div className="py-8 text-center text-sm text-muted-foreground">No location data available yet.</div>
                    )}
                  </div>
                </section>
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <section className="overflow-hidden rounded-lg border border-border bg-card">
                  <div className="border-b border-border px-5 py-4"><h3 className="text-sm font-medium">Response time</h3><p className="mt-1 text-xs text-muted-foreground">Average time for your site to respond to visitors.</p></div>
                  <div className="flex items-end justify-between gap-6 p-5"><div><p className="text-3xl font-semibold tracking-[-0.04em]">{metrics?.avgResponse || 0}<span className="ml-1 text-base font-medium text-muted-foreground">ms</span></p><p className="mt-1 text-xs text-muted-foreground">Live real-time average</p></div><div className="flex h-12 items-end gap-1" aria-label="Response time trend"><span className="h-5 w-2 rounded-sm bg-zinc-700" /><span className="h-8 w-2 rounded-sm bg-zinc-600" /><span className="h-6 w-2 rounded-sm bg-zinc-700" /><span className="h-10 w-2 rounded-sm bg-zinc-500" /><span className="h-7 w-2 rounded-sm bg-zinc-600" /><span className="h-9 w-2 rounded-sm bg-zinc-500" /><span className="h-11 w-2 rounded-sm bg-zinc-400" /></div></div>
                </section>
                <section className="overflow-hidden rounded-lg border border-border bg-card">
                  <div className="border-b border-border px-5 py-4"><h3 className="text-sm font-medium">Deployment health</h3><p className="mt-1 text-xs text-muted-foreground">Success rate across your last 20 deployments.</p></div>
                  <div className="flex items-center justify-between gap-6 p-5"><div><p className="text-3xl font-semibold tracking-[-0.04em]">{metrics?.health || 100}<span className="ml-1 text-base font-medium text-muted-foreground">%</span></p><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><CircleCheck className="size-3.5 text-emerald-400" />{metrics?.successfulDeployments || 0} successful · <CircleX className="size-3.5 text-red-400" />{metrics?.failedDeployments || 0} failed</p></div><div className="flex size-16 items-center justify-center rounded-full border-4 border-emerald-500/80 border-l-zinc-800 border-b-zinc-800 text-[11px] font-medium text-zinc-300">{metrics?.successfulDeployments || 0}/{metrics?.totalDeployments || 0}</div></div>
                </section>
              </div>
            </div>
          )}
          {activeTab === "Deployments" && (
            <div className="app-scroll grid w-full grid-cols-1 items-start gap-5 overflow-y-auto pb-8 lg:grid-cols-12">
              <div className="flex flex-col gap-3 lg:col-span-8">
                <div className="flex items-center justify-between">
                  <div><h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">Deployments</h2><p className="mt-1 text-xs text-muted-foreground">Select a deployment to inspect its build output.</p></div>
                  <span className="font-mono text-[11px] text-zinc-500">{deployments.length} total</span>
                </div>
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  {deployments.map((d, index) => {
                    const isCurrent = index === 0 && d.status === 'SUCCESS';
                    const isActiveView = activeDeploy?.id === d.id;
                    return (
                      <div
                        key={d.id}
                        onClick={() => { setActiveDeploy(d); setLogs([]); }}
                        className={`group flex items-center justify-between border-b border-border px-4 py-3.5 transition-colors last:border-b-0 cursor-pointer ${
                          isActiveView
                            ? 'bg-zinc-900/80'
                            : 'hover:bg-zinc-900/50'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={`size-2 shrink-0 rounded-full ${d.status === 'SUCCESS' ? 'bg-emerald-400' : d.status === 'FAILED' ? 'bg-red-400' : 'bg-zinc-500'}`} />
                          <div className="min-w-0 flex flex-col gap-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-sm font-medium text-foreground">
                                {d.commitSha.slice(0, 7)}
                              </span>
                              {isCurrent && (
                                <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium tracking-wider text-emerald-400">
                                  PRODUCTION
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <GitBranch className="size-3" /> {d.branch || 'main'}
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="size-3" />
                                {new Date(d.deployedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 flex shrink-0 items-center gap-3">
                          {renderStatusBadge(d.status)}
                        </div>
                      </div>
                    );
                  })}
                  {deployments.length === 0 && (
                    <div className="p-12 text-center text-sm text-muted-foreground">
                      No deployments found. Trigger a deploy to see history here.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-4 lg:col-span-4">
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  <div className="border-b border-border bg-zinc-900/30 px-4 py-3">
                    <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-500">Current deployment</h3>
                  </div>
                  <div className="p-4 flex flex-col gap-4 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Status</span>
                      {renderStatusBadge(currentDeployStatus)}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Runtime</span>
                      <span className="text-foreground font-mono text-[11px] tracking-tight">Node.js 22.x</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Build Time</span>
                      <span className="text-foreground font-mono text-[11px] tracking-tight">~45s</span>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  <div className="border-b border-border bg-zinc-900/30 px-4 py-3">
                    <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-500">Build configuration</h3>
                  </div>
                  <div className="p-4 flex flex-col gap-4 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Framework</span>
                      <span className="text-foreground font-mono text-[11px] tracking-tight bg-muted px-2 py-0.5 rounded border border-border">{project.preset || 'Next.js'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Command</span>
                      <span className="text-foreground font-mono text-[11px] tracking-tight bg-muted px-2 py-0.5 rounded border border-border">{project.buildCommand || 'npm run build'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "Logs" && (
            <div className="flex h-[calc(100vh-340px)] min-h-[400px] w-full flex-col overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex shrink-0 flex-col gap-4 border-b border-border bg-zinc-900/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Build logs</span>
                  <span className="font-mono text-xs text-muted-foreground">{activeDeploy?.commitSha?.slice(0,7) || 'No deployment selected'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input value={logQuery} onChange={(event) => setLogQuery(event.target.value)} placeholder="Find in logs" className="h-7 w-40 rounded-md border border-zinc-700 bg-zinc-950 pl-7 pr-2 text-xs outline-none placeholder:text-zinc-500 focus:border-zinc-500" />
                  </div>
                  <Button variant="ghost" size="icon-xs" title="Copy logs" onClick={() => void copyLogs()}><Copy /></Button>
                  <Button variant="ghost" size="icon-xs" title="Download logs" onClick={downloadLogs}><Download /></Button>
                  {renderStatusBadge(activeDeploy?.status || '')}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-zinc-950 font-mono text-xs leading-5 text-zinc-300">
                {logs.length === 0 && <div className="flex h-full min-h-80 items-center justify-center gap-2 text-zinc-500 animate-pulse"><RefreshCw className="size-3.5 animate-spin" />Waiting for build output</div>}
                {logs.filter((log) => log.text.toLowerCase().includes(logQuery.toLowerCase())).map((log, i) => (
                  <div key={i} className="grid grid-cols-[78px_minmax(0,1fr)] px-4 py-1 hover:bg-zinc-900/70">
                    <span className="select-none text-zinc-600">{String(i + 1).padStart(4, '0')}</span>
                    <span className={`break-words whitespace-pre-wrap ${
                      log.stream === 'STDERR' || log.text.toLowerCase().includes('error') || log.text.toLowerCase().includes('failed')
                        ? 'text-red-400'
                        : 'text-zinc-400'
                    }`}>{log.text}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>

              <div className="flex shrink-0 items-center justify-between border-t border-border bg-zinc-900/50 px-4 py-2">
                <span className="text-xs text-muted-foreground">Streaming · {activeDeploy?.triggerSource === 'WEBHOOK' ? 'Git push' : 'Manual deployment'}</span>
                <a href={siteUrl(project.subdomain || '')} target="_blank" rel="noreferrer">
                  <Button variant="ghost" size="sm">
                    Visit deployment <ExternalLink data-icon="inline-end" />
                  </Button>
                </a>
              </div>
            </div>
          )}

          {activeTab === "Settings" && (
            <div className="app-scroll flex w-full flex-col gap-8 overflow-y-auto pb-12">
              <div className="flex flex-col items-start gap-8 md:flex-row">
                <div className="flex w-full flex-col gap-2 md:w-1/3">
                  <p className="section-label">Project</p><h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">General settings</h2>
                  <p className="text-sm text-muted-foreground">Update your project&apos;s general settings and repository connections.</p>
                </div>
                <div className="w-full overflow-hidden rounded-lg border border-border bg-card md:w-2/3">
                  <div className="flex flex-col gap-5 p-5">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-foreground">Project Name</label>
                      <input
                        type="text"
                        className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                        value={settingsForm.name || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-foreground">Production Branch</label>
                      <input
                        type="text"
                        className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                        value={settingsForm.branch || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, branch: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-foreground">Root Directory</label>
                      <input
                        type="text"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:ring-1 focus:ring-ring"
                        value={settingsForm.rootDirectory || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, rootDirectory: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end border-t border-border bg-zinc-900/30 px-5 py-3">
                    <Button onClick={saveSettings} disabled={isSaving}>
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-8 border-t border-border pt-8 md:flex-row">
                <div className="w-full md:w-1/3">
                  <p className="section-label">Environment</p>
                  <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em]">Environment Variables</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Manage environment variables for your project. These are securely injected during the build step.</p>
                </div>
                <div className="w-full md:w-2/3">
                  <EnvironmentVariableEditor value={envVars} onChange={(variables) => { setEnvVars(variables); setHasEnvChanges(true); }} />
                  <div className="mt-3 flex justify-end rounded-lg border border-border bg-muted/20 px-4 py-3">
                    <Button onClick={saveEnvVars} disabled={isSavingEnv}>
                      {isSavingEnv ? 'Saving...' : 'Save variables'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-8 border-t border-border pt-8 md:flex-row">
                <div className="w-full md:w-1/3"><p className="section-label">Build</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.02em]">Build settings</h2><p className="mt-1 text-sm text-muted-foreground">Set the command and output used for production deployments.</p></div>
                <div className="w-full overflow-hidden rounded-lg border border-border bg-card md:w-2/3">
                  <div className="flex flex-col gap-6 p-6">
                    <div className="flex flex-col gap-2"><label className="text-sm font-medium">Build Command</label><input type="text" className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-1 focus:ring-ring" value={settingsForm.buildCommand || ''} onChange={(e) => setSettingsForm({ ...settingsForm, buildCommand: e.target.value })} /></div>
                    <div className="flex flex-col gap-2"><label className="text-sm font-medium">Output Directory</label><input type="text" className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-1 focus:ring-ring" value={settingsForm.outputDirectory || ''} onChange={(e) => setSettingsForm({ ...settingsForm, outputDirectory: e.target.value })} /></div>
                  </div>
                  <div className="flex justify-end border-t border-border bg-zinc-900/30 px-6 py-4"><Button onClick={saveSettings} disabled={isSaving}>{isSaving ? 'Saving…' : 'Save build settings'}</Button></div>
                </div>
              </div>

              <div className="flex flex-col gap-8 border-t border-border pt-8 md:flex-row">
                <div className="w-full md:w-1/3"><p className="section-label">Source control</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.02em]">Git integration</h2><p className="mt-1 text-sm text-muted-foreground">Connect pushes on your production branch to automatic deployments.</p></div>
                <Card className="w-full overflow-hidden md:w-2/3">
                  <CardHeader className="flex-row items-start justify-between gap-4 border-b border-border">
                    <div className="flex min-w-0 gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
                        <Webhook className="size-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-sm">GitHub auto-deploy</CardTitle>
                        <CardDescription className="mt-1 text-xs leading-5">
                          One webhook deploys pushes to the configured production branch.
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className={webhookStatus?.enabled ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "text-muted-foreground"}>
                      {webhookStatus?.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </CardHeader>
                  <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Repository</p>
                      <p className="mt-1 truncate font-mono text-xs">{webhookStatus?.repository || project.repoUrl}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Production branch</p>
                      <p className="mt-1 flex items-center gap-1.5 font-mono text-xs"><GitBranch className="size-3.5" />{webhookStatus?.branch || project.branch || 'main'}</p>
                    </div>
                  </CardContent>
                  <CardFooter className="justify-between gap-4 border-t border-border bg-muted/20 pt-6">
                    <p className="text-xs text-muted-foreground">
                      {webhookStatus?.canEnable === false
                        ? 'Limit reached: disable auto-deploy on another project first.'
                        : 'Pushes create a deployment automatically; repeated commit deliveries are ignored.'}
                    </p>
                    {webhookStatus?.enabled ? (
                      <Button variant="outline" size="sm" onClick={disableWebhook} disabled={webhookAction !== null}>
                        {webhookAction === 'disable' ? 'Disconnecting…' : 'Disable'}
                      </Button>
                    ) : (
                      <Button size="sm" onClick={enableWebhook} disabled={webhookAction !== null || webhookStatus?.canEnable === false}>
                        {webhookAction === 'enable' ? 'Connecting…' : 'Enable'}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              </div>

              <div className="mt-8 flex flex-col items-start gap-8 md:flex-row">
                <div className="flex w-full flex-col gap-2 md:w-1/3">
                  <p className="section-label text-destructive/80">Danger zone</p><h2 className="text-lg font-semibold text-destructive">Delete project</h2>
                  <p className="text-sm text-muted-foreground">Irreversible and destructive actions.</p>
                </div>
                <div className="w-full md:w-2/3 border border-destructive/30 rounded-lg bg-destructive/5 overflow-hidden">
                  <div className="p-6 flex flex-col gap-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <h4 className="text-sm font-bold text-foreground">Delete Project</h4>
                        <p className="text-xs text-muted-foreground">Permanently remove this project and all its deployments.</p>
                      </div>
                      <Button onClick={() => setShowDeleteAlert(true)} variant="destructive" className="shrink-0 font-medium">
                        Delete Project
                      </Button>
                      
                      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the project <strong className="text-foreground">{project?.name}</strong> and remove all associated deployments and data from our servers.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={deleteProject} 
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete Project
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "Domains" && (
            <div className="flex w-full flex-col gap-5 overflow-y-auto pb-8">
              <div><h2 className="text-lg font-semibold tracking-[-0.02em]">Domains</h2><p className="mt-1 text-sm text-muted-foreground">Manage where people can reach this project.</p></div>
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h3 className="text-sm font-medium">Production domain</h3><p className="mt-1 text-xs text-muted-foreground">The default URL for your live deployment.</p></div><Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/5 text-emerald-400"><span className="size-1.5 rounded-full bg-emerald-400" />Active</Badge></div>
                <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"><div className="flex min-w-0 items-center gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400"><Globe className="size-4" /></div><div className="min-w-0"><p className="truncate font-mono text-sm text-zinc-200">{siteHostname(project.subdomain || '')}</p><p className="mt-1 text-xs text-muted-foreground">Managed by Kyte</p></div></div><a href={siteUrl(project.subdomain || '')} target="_blank" rel="noreferrer"><Button variant="outline" size="sm">Visit domain<ExternalLink data-icon="inline-end" /></Button></a></div>
              </div>
              <DomainManager projectId={projectId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
