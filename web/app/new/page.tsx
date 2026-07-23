"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FaGithub, FaLock } from "react-icons/fa";
import { SiNextdotjs, SiReact, SiVuedotjs } from "react-icons/si";
import { Box, GitBranch, Search, Settings2, ArrowRight, Globe, ExternalLink, Activity, BadgeCheck, LogOut, FileText, Terminal, CircleAlert, CheckCircle2, KeyRound, RefreshCw } from "lucide-react";
import { useApiRequest, useApiToken } from "@/hooks/use-api";
import { useUser, useClerk } from "@clerk/nextjs";
import { UserAvatar } from "@/components/user-avatar";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EnvironmentVariableEditor } from "@/components/environment-variable-editor";
import { streamDeploymentLogs } from "@/lib/deployment-log-stream";
import { siteUrl } from "@/lib/site-url";
import { cn } from "@/lib/utils";

interface GithubRepo {
  id: number;
  name: string;
  private: boolean;
  updatedAt: string;
  htmlUrl: string;
}

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
}

interface Deployment {
  id: string;
  status: string;
  commitSha: string;
  deployedAt: string;
  branch?: string;
  triggerSource?: string;
}

interface ProjectLimit {
  limit: number;
  used: number;
  remaining: number;
  canCreate: boolean;
}

type PreviewState = 'checking' | 'loading' | 'ready' | 'error';

function serializeEnvironmentVariables(
  variables: Array<{ key: string; value: string }>,
) {
  return variables
    .filter((variable) => variable.key.trim())
    .map((variable) => ({
      key: variable.key.trim(),
      value: variable.value,
    }));
}

export default function NewProjectPage() {
  const [step, setStep] = useState(1);
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUsername, setGithubUsername] = useState("");
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [searchRepo, setSearchRepo] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [projectName, setProjectName] = useState("");
  
  // Build and Output settings
  const [preset, setPreset] = useState("React");
  const [rootDirectory, setRootDirectory] = useState("./");
  const [buildCommand, setBuildCommand] = useState("npm run build");
  const [outputDirectory, setOutputDirectory] = useState("dist");
  const [envVars, setEnvVars] = useState<{key: string, value: string}[]>([{ key: "", value: "" }]);
  const [branch, setBranch] = useState("main");
  
  // Organization settings
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [organizationsLoading, setOrganizationsLoading] = useState(true);
  const [projectLimit, setProjectLimit] = useState<ProjectLimit | null>(null);
  const [projectLimitLoading, setProjectLimitLoading] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  
  const apiRequest = useApiRequest();
  const getClerkToken = useApiToken();
  const router = useRouter();
  
  const { isLoaded, user } = useUser();
  const { signOut } = useClerk();
  
  const userName = user?.username || user?.fullName || 'User';
  const userEmail = user?.primaryEmailAddress?.emailAddress || '';

  const [project, setProject] = useState<Project | null>(null);
  const [activeDeploy, setActiveDeploy] = useState<Deployment | null>(null);
  const [deployStatus, setDeployStatus] = useState<'QUEUED' | 'BUILDING' | 'SUCCESS' | 'FAILED'>('QUEUED');
  const [logs, setLogs] = useState<{ stream: string; text: string }[]>([]);
  const [previewState, setPreviewState] = useState<PreviewState>('checking');
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (previewState !== 'loading') return;
    const timer = setTimeout(() => setPreviewState('error'), 15_000);
    return () => clearTimeout(timer);
  }, [previewState]);

  const retryPreview = () => {
    setPreviewState('loading');
    setPreviewAttempt((attempt) => attempt + 1);
  };

  async function checkGithubConnection() {
    try {
      setLoadingRepos(true);
      const user = await apiRequest("GET", "/auth/me");
      if (user.githubConnected) {
        setGithubConnected(true);
        setGithubUsername(user.githubUsername);
        void fetchGithubRepos();
      } else {
        setLoadingRepos(false);
      }
    } catch {
      setLoadingRepos(false);
    }
  }

  async function fetchGithubRepos() {
    try {
      const data = await apiRequest("GET", "/auth/github/repos");
      setRepos(data.repos || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRepos(false);
    }
  }

  async function fetchOrganizations() {
    try {
      const res = await apiRequest("GET", "/organizations");
      const availableOrganizations: { id: string }[] = res.organizations || [];
      if (availableOrganizations.length > 0) {
        const savedOrgId = typeof window !== 'undefined' ? localStorage.getItem("kyte-active-org") : null;
        if (savedOrgId && availableOrganizations.some((o) => o.id === savedOrgId)) {
          setSelectedOrgId(savedOrgId);
        } else {
          setSelectedOrgId(availableOrganizations[0].id);
        }
      } else {
        setSelectedOrgId("");
        router.replace("/onboarding");
      }
    } catch (err) {
      console.error(err);
      setError("Could not load your organizations. Refresh the page and try again.");
    } finally {
      setOrganizationsLoading(false);
    }
  }

  async function fetchProjectLimit() {
    try {
      const limit = await apiRequest("GET", "/projects/limits");
      setProjectLimit(limit);
    } catch (err) {
      console.error(err);
      setError("Could not load your project allowance. Refresh the page and try again.");
    } finally {
      setProjectLimitLoading(false);
    }
  }

  useEffect(() => {
    document.title = "New Project | Kyte";
    const timer = setTimeout(() => {
      void checkGithubConnection();
      void fetchOrganizations();
      void fetchProjectLimit();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRepos = repos.filter(repo => 
    repo.name.toLowerCase().includes(searchRepo.toLowerCase())
  );

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl) return;
    setProjectName(importUrl.split('/').pop() || "my-project");
    setStep(2);
  };

  const handleConnectGithub = async () => {
    try {
      const res = await apiRequest("GET", "/auth/github/connect");
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to connect GitHub";
      setError(errorMsg);
    }
  };

  useEffect(() => {
    if (!activeDeploy || step !== 3) return;
    const controller = new AbortController();
    (async () => {
      const token = await getClerkToken();
      if (!token) return;
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost/api';
      await streamDeploymentLogs(
        `${API_BASE}/projects/${project?.id}/deployments/${activeDeploy.id}/logs`,
        token,
        (data) => {
          setLogs(prev => [...prev, data]);
          
          setDeployStatus(prev => prev === 'QUEUED' ? 'BUILDING' : prev);

          if (data.text.includes('Deploy complete.')) {
             setDeployStatus('SUCCESS');
             setTimeout(() => {
               setPreviewState('loading');
               setStep(4);
             }, 3000);
             controller.abort();
          } else if (data.text.includes('Build failed:')) {
             setDeployStatus('FAILED');
             setError("Deployment failed. Please check the logs.");
             controller.abort();
          }
        },
        controller.signal,
      );
    })().catch((error) => {
      if (!controller.signal.aborted) {
        setError(error instanceof Error ? error.message : "Deployment log connection failed");
      }
    });
    return () => controller.abort();
  }, [activeDeploy, getClerkToken, project?.id, step]);

  const handleDeploy = async () => {
    if (!selectedOrgId) {
      setError("Select an organization before creating the project.");
      return;
    }
    if (projectLimit && !projectLimit.canCreate) {
      setError(`You have reached the ${projectLimit.limit}-project limit. Delete a project before creating another.`);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const proj = await apiRequest("POST", "/projects", {
        name: projectName,
        repoUrl: importUrl,
        preset,
        rootDirectory,
        buildCommand,
        outputDirectory,
        branch,
        organizationId: selectedOrgId,
        environmentVariables: serializeEnvironmentVariables(envVars),
      });
      setProject(proj);

      const deployRes = await apiRequest('POST', `/projects/${proj.id}/deployments`, {
        commitSha: 'HEAD',
      });
      setActiveDeploy(deployRes);
      setPreviewState('checking');
      setPreviewAttempt(0);
      
      setStep(3);
      setLoading(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to deploy project";
      setError(errorMsg);
      setLoading(false);
    }
  };

  const getLogTone = (log: { stream: string; text: string }) => {
    const text = log.text.toLowerCase();
    if (log.stream === 'STDERR' || text.includes('error') || text.includes('failed')) {
      return 'border-l-red-400/80 bg-red-500/[0.07] text-red-200';
    }
    if (text.includes('warn')) {
      return 'border-l-amber-400/80 bg-amber-500/[0.06] text-amber-100';
    }
    if (text.includes('complete') || text.includes('success') || text.includes('deployed')) {
      return 'border-l-emerald-400/80 bg-emerald-500/[0.06] text-emerald-200';
    }
    if (text.startsWith('$') || text.includes('running') || text.includes('installing')) {
      return 'border-l-sky-400/70 bg-sky-500/[0.05] text-sky-100';
    }
    return 'border-l-transparent text-zinc-400';
  };

  return (
    <div className="flex h-screen overflow-hidden w-full flex-col relative px-4 sm:px-8 bg-[#09090B]">
      {step < 4 && (
        <div className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-4 sm:px-8 z-10 border-b border-white/5 bg-[#09090B]/80 backdrop-blur-md">
          <div className="w-1/3 flex justify-start">
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')} className="text-zinc-400 hover:text-white -ml-2 transition-colors">
              <ArrowRight className="mr-2 size-3.5 rotate-180" /> Back
            </Button>
          </div>
          <div className="w-1/3 flex justify-center">
            <span className="text-[13px] font-medium text-zinc-200 tracking-wide">New Project</span>
          </div>
          <div className="w-1/3 flex justify-end">
            {isLoaded && user && (
              <div className="relative">
                <button
                  type="button"
                  aria-label="Open account menu"
                  aria-expanded={isAccountMenuOpen}
                  onClick={() => setIsAccountMenuOpen((open) => !open)}
                  className="overflow-hidden rounded-full outline-none ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <UserAvatar size={32} name={userName} />
                </button>
                {isAccountMenuOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg" role="menu">
                    <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
                      <UserAvatar size={32} name={userName} />
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">{userName}</span>
                        <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
                      </div>
                    </div>
                    <div className="my-1 h-px bg-border" />
                    <button type="button" role="menuitem" onClick={() => { setIsAccountMenuOpen(false); router.push('/settings'); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent">
                      <BadgeCheck className="size-4" />
                      Manage Account
                    </button>
                    <button type="button" role="menuitem" onClick={() => { setIsAccountMenuOpen(false); router.push('/docs'); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent">
                      <FileText className="size-4" />
                      Docs
                    </button>
                    <div className="my-1 h-px bg-border" />
                    <button type="button" role="menuitem" onClick={() => void signOut()} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-destructive outline-none hover:bg-destructive/10">
                      <LogOut className="size-4" />
                    Log out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="mx-auto w-full h-full max-w-3xl pt-16 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="h-full overflow-y-auto w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="grid min-h-full place-items-center py-12 px-4 sm:px-0">
            <div className="w-full max-w-3xl">
      {step === 1 && (
        <Card className="w-full overflow-hidden rounded-xl border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/20">
          <CardHeader className="gap-1.5 border-b border-zinc-800/70 px-6 py-5">
            <CardTitle className="text-lg tracking-[-0.02em]">Import Git Repository</CardTitle>
            <CardDescription className="text-[13px] leading-5">Connect your GitHub account to import private repositories.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 px-6 py-5">
            {loadingRepos ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : !githubConnected ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700/80 bg-zinc-900/30 px-6 py-10 text-center">
                <div className="mb-4 flex size-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-200"><FaGithub className="size-5" /></div>
                <h3 className="mb-1.5 text-sm font-medium">Connect to GitHub</h3>
                <p className="mb-5 max-w-sm text-[13px] leading-5 text-muted-foreground">
                  Connect your GitHub account to import and deploy your private repositories directly.
                </p>
                <Button onClick={handleConnectGithub} className="h-8 px-3 text-[13px]">
                  <FaGithub className="size-3.5" /> Connect GitHub
                </Button>
                {error && <p className="text-sm text-destructive mt-4">{error}</p>}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900">
                      <FaGithub className="size-4" />
                    </div>
                    <span className="text-[13px] font-medium">{githubUsername}</span>
                  </div>
                  <div className="relative w-60">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <Input 
                      type="text" 
                      value={searchRepo}
                      onChange={e => setSearchRepo(e.target.value)}
                      placeholder="Search repositories..." 
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex max-h-[350px] flex-col gap-1 overflow-y-auto pr-2">
                  {filteredRepos.length > 0 ? filteredRepos.map(repo => (
                    <div key={repo.id} className="flex items-center justify-between rounded-md border border-transparent px-3 py-2.5 transition-colors hover:border-zinc-800 hover:bg-zinc-900/70">
                      <div className="flex min-w-0 items-center gap-3">
                        <Box className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate text-[13px] font-medium">{repo.name}</span>
                        {repo.private && <FaLock className="size-3 text-muted-foreground" title="Private" />}
                        <span className="hidden rounded-sm bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
                          {new Date(repo.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <Button 
                        size="sm"
                        variant="secondary"
                        onClick={() => { setImportUrl(repo.htmlUrl); setProjectName(repo.name); setStep(2); }}
                      >
                        Import
                      </Button>
                    </div>
                  )) : (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                      <Box className="size-10 mb-4 opacity-20" />
                      <p className="text-sm">No repositories found.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-3 py-0.5">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">or</span>
              <Separator className="flex-1" />
            </div>
            
            <form onSubmit={handleImport} className="flex flex-col gap-2">
              <Label htmlFor="import-url">Import Third-Party Git Repository</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <GitBranch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input 
                    id="import-url"
                    type="url" 
                    required
                    value={importUrl}
                    onChange={e => setImportUrl(e.target.value)}
                    placeholder="https://github.com/user/repo" 
                    className="pl-10"
                  />
                </div>
                <Button type="submit" variant="secondary" className="h-8">
                  Import
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-12">
          <Card className="flex-shrink-0 overflow-hidden rounded-xl border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/20">
            <CardHeader className="gap-4 border-b border-zinc-800/70 px-6 py-5">
              <CardTitle className="text-lg tracking-[-0.02em]">New Project</CardTitle>
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3.5 py-3">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">Importing from GitHub</p>
                <div className="flex items-center gap-2">
                  <FaGithub className="size-3.5 shrink-0 text-zinc-300" />
                  <span className="min-w-0 truncate text-[13px] font-medium text-zinc-200">{importUrl.replace('https://github.com/', '') || 'repository'}</span>
                  <div className="ml-1 flex shrink-0 items-center gap-1 text-zinc-500">
                    <GitBranch className="size-3" />
                    <span className="font-mono text-[11px]">{branch || 'main'}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 px-6 py-5">
              <p className="-mb-1 text-[13px] leading-5 text-zinc-400">Choose where you want to create the project and give it a name.</p>
              <div className="flex flex-col gap-2">
                <Label htmlFor="project-name">Project Name</Label>
                <Input 
                  id="project-name"
                  type="text" 
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="branch">Production Branch</Label>
                <Input 
                  id="branch"
                  type="text" 
                  value={branch}
                  onChange={e => setBranch(e.target.value)}
                  placeholder="main"
                />
                <p className="text-xs leading-5 text-muted-foreground">The GitHub branch that will be deployed.</p>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Framework Preset</Label>
                <Select value={preset} onValueChange={(val) => {
                  const presetVal = val as string;
                  setPreset(presetVal);
                  if (presetVal === 'Next.js') {
                    setBuildCommand('npm run build');
                    setOutputDirectory('out');
                  } else if (presetVal === 'React') {
                    setBuildCommand('npm run build');
                    setOutputDirectory('dist');
                  } else if (presetVal === 'Vue') {
                    setBuildCommand('npm run build');
                    setOutputDirectory('dist');
                  } else if (presetVal === 'Other') {
                    setBuildCommand('');
                    setOutputDirectory('');
                  }
                }}>
                  <SelectTrigger className="w-full h-11">
                    <SelectValue placeholder="Select a preset" />
                  </SelectTrigger>
                  <SelectContent align="start" sideOffset={8}>
                    <SelectGroup>
                      <SelectItem value="Next.js">
                        <div className="flex items-center gap-2">
                          <div className="flex size-5 items-center justify-center rounded-full bg-white text-black">
                            <SiNextdotjs className="size-3" />
                          </div>
                          Next.js
                        </div>
                      </SelectItem>
                      <SelectItem value="React">
                        <div className="flex items-center gap-2">
                          <SiReact className="size-5 text-[#61DAFB]" />
                          React (Vite)
                        </div>
                      </SelectItem>
                      <SelectItem value="Vue">
                        <div className="flex items-center gap-2">
                          <SiVuedotjs className="size-5 text-[#41B883]" />
                          Vue.js
                        </div>
                      </SelectItem>
                      <SelectItem value="Other">
                        <div className="flex items-center gap-2">
                          <Box className="size-5 text-zinc-400" />
                          Other
                        </div>
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {preset === 'Next.js' && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <strong>Note:</strong> Next.js projects must be configured for static export to work on this platform. Add <code className="text-primary bg-primary/10 px-1 py-0.5 rounded">output: &apos;export&apos;</code> to your <code className="text-primary bg-primary/10 px-1 py-0.5 rounded">next.config.js</code> file.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label>Root Directory</Label>
                <div className="flex gap-2">
                  <Input 
                    type="text" 
                    value={rootDirectory}
                    onChange={e => setRootDirectory(e.target.value)}
                    placeholder="./"
                  />
                </div>
                <p className="text-xs leading-5 text-muted-foreground">The directory within your project that contains the source code.</p>
              </div>

              <Accordion className="mt-1 w-full rounded-lg border border-zinc-800 px-4">
                <AccordionItem value="build-settings" className="border-none">
                  <AccordionTrigger className="py-3 text-[14px] hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Settings2 className="size-3.5 text-muted-foreground" />
                      <span className="font-medium text-zinc-300">Build and Output Settings</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="flex flex-col gap-4 pb-4">
                    <div className="flex flex-col gap-2 pt-2">
                      <Label>Build Command</Label>
                      <Input 
                        type="text" 
                        value={buildCommand}
                        onChange={e => setBuildCommand(e.target.value)}
                        placeholder="npm run build"
                      />
                      <p className="text-xs leading-5 text-muted-foreground">The command your framework uses to build your app.</p>
                    </div>
                    <div className="flex flex-col gap-2 pt-2">
                      <Label>Output Directory</Label>
                      <Input 
                        type="text" 
                        value={outputDirectory}
                        onChange={e => setOutputDirectory(e.target.value)}
                        placeholder=".next, build, dist"
                      />
                      <p className="text-xs leading-5 text-muted-foreground">The directory where your framework outputs its build.</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Accordion className="mt-1 w-full rounded-lg border border-zinc-800 px-4">
                <AccordionItem value="environment-variables" className="border-none">
                  <AccordionTrigger className="py-3 text-[14px] hover:no-underline">
                    <div className="flex items-center gap-2">
                      <KeyRound className="size-3.5 text-muted-foreground" />
                      <span className="font-medium text-zinc-300">Environment Variables</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pt-2">
                    <EnvironmentVariableEditor value={envVars} onChange={setEnvVars} compact />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </CardContent>
            <CardFooter className="border-t border-zinc-800/70 bg-zinc-900/30 px-6 py-4">
              <Button 
                onClick={handleDeploy}
                disabled={loading || organizationsLoading || projectLimitLoading || !selectedOrgId || !projectLimit?.canCreate}
                className="h-8 w-full text-[13px] sm:w-auto"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="size-4 rounded-full border-2 border-t-transparent border-primary-foreground animate-spin" />
                    Deploying...
                  </div>
                ) : (
                  "Deploy Project"
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
      {step === 3 && (
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-5 px-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-500">Deployment</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-zinc-100">Building {projectName}</h1>
            <p className="mt-1 text-[13px] text-zinc-500">Your project is being prepared and deployed.</p>
          </div>
        <Card className="flex flex-col overflow-hidden rounded-xl border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/30">
          <CardHeader className="flex-row items-center justify-between border-b border-zinc-800 bg-zinc-900/40 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-300 shadow-sm">
                <Terminal className="size-4" />
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate text-[15px] tracking-[-0.015em]">Live build logs</CardTitle>
                <CardDescription className="mt-0.5 text-[12px]">Output appears here while the deployment runs.</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1.5 border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-[10px] font-medium text-zinc-400">
                <span className={`size-1.5 rounded-full ${deployStatus === 'SUCCESS' ? 'bg-emerald-400' : deployStatus === 'FAILED' ? 'bg-red-400' : 'animate-pulse bg-zinc-400'}`} />
                {deployStatus}
              </Badge>
              {(deployStatus === 'QUEUED' || deployStatus === 'BUILDING') && (
                <div className="size-3.5 rounded-full border-2 border-zinc-700 border-t-zinc-300 animate-spin" />
              )}
            </div>
          </CardHeader>
          <CardContent className="flex h-[390px] flex-col bg-[#0a0a0b] p-0 sm:h-[460px]">
            <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950 px-4 py-2">
              <div className="flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                <span className="size-1.5 animate-pulse rounded-full bg-zinc-400" /> Live output
              </div>
              <span className="font-mono text-[10px] text-zinc-600">{logs.length} {logs.length === 1 ? 'event' : 'events'}</span>
            </div>
            <div className="terminal-scroll min-h-0 flex-1 overflow-y-scroll py-3 font-mono text-[12px] leading-5">
              {logs.length === 0 && (
                <div className="flex min-h-[270px] flex-col items-center justify-center px-6 text-center">
                  <div className="mb-3 flex size-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-300"><Terminal className="size-4" /></div>
                  <p className="text-[13px] font-medium text-zinc-300">Preparing build environment</p>
                  <p className="mt-1 max-w-xs text-xs leading-5 text-zinc-600">Build output will stream here as soon as the worker starts.</p>
                </div>
              )}
              {logs.map((log, i) => (
                <div key={i} className={`group grid grid-cols-[2.75rem_minmax(0,1fr)] border-l-2 px-3 py-1 transition-colors hover:bg-white/[0.025] ${getLogTone(log)}`}>
                  <span className="select-none text-right text-[10px] text-zinc-700 group-hover:text-zinc-500">{String(i + 1).padStart(3, '0')}</span>
                  <span className="min-w-0 break-words pl-3">{log.text}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </CardContent>
          <CardFooter className="flex items-center justify-between border-t border-zinc-800 bg-zinc-900/30 p-3">
            <span className="hidden items-center gap-1.5 text-[11px] text-zinc-500 sm:flex">
              {deployStatus === 'FAILED' ? <CircleAlert className="size-3.5 text-red-400" /> : <CheckCircle2 className="size-3.5 text-zinc-500" />}
              {deployStatus === 'FAILED' ? 'Build stopped with an error' : 'Logs update automatically'}
            </span>
             {deployStatus === 'FAILED' ? (
               <Button onClick={() => router.push(`/projects/${project?.id}`)}>
                 Go to Project Details
               </Button>
             ) : (
               <Button variant="outline" onClick={() => router.push(`/projects/${project?.id}`)}>
                 View Details
               </Button>
             )}
          </CardFooter>
        </Card>
        </div>
      )}

      {step === 4 && (
        <div className="mx-auto flex w-full max-w-[580px] flex-col animate-in slide-in-from-bottom-4 duration-500 fade-in fill-mode-both">
          <Card className="flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/90 shadow-2xl shadow-black/30">
            
            {/* Header Area inside Card */}
            <div className="flex flex-col border-b border-zinc-800/70 px-6 pb-5 pt-6 text-center sm:text-left">
              <h2 className="text-xl font-semibold tracking-[-0.025em] text-white">Deployment complete</h2>
              <p className="mt-1 text-[13px] leading-5 text-zinc-400">
                You just deployed <span className="font-semibold text-white">{projectName}</span> to Kyte.
              </p>
            </div>

            {/* Preview Container - inside Card */}
            <div className="mx-6 mb-2 mt-5 overflow-hidden rounded-lg border border-zinc-800 bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
              <div className="flex items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900/60 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={cn('size-1.5 rounded-full', previewState === 'ready' && 'bg-emerald-400', previewState === 'error' && 'bg-red-400', (previewState === 'checking' || previewState === 'loading') && 'animate-pulse bg-zinc-400')} />
                  <span className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-500">Live preview</span>
                </div>
                <span className="font-mono text-[10px] text-zinc-600">
                  {previewState === 'ready' ? 'Ready' : previewState === 'error' ? 'Unavailable' : 'Warming up'}
                </span>
              </div>
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-950">
                {previewState !== 'error' && project?.subdomain && (
                  <iframe
                    key={previewAttempt}
                    src={siteUrl(project.subdomain, `?__kyte_preview=1&attempt=${previewAttempt}`)}
                    className={cn('pointer-events-none absolute left-0 top-0 h-[200%] w-[200%] origin-top-left scale-50 border-none transition-opacity duration-300', previewState === 'ready' ? 'opacity-100' : 'opacity-0')}
                    scrolling="no"
                    tabIndex={-1}
                    style={{ overflow: 'hidden' }}
                    title="Project Preview"
                    onLoad={() => setPreviewState('ready')}
                    onError={() => setPreviewState('error')}
                  />
                )}

                {(previewState === 'checking' || previewState === 'loading') && (
                  <div className="absolute inset-0 flex flex-col gap-4 p-5" role="status" aria-live="polite">
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <RefreshCw className="animate-spin" />
                      {previewState === 'checking' ? 'Waiting for the deployment URL…' : 'Loading the website preview…'}
                    </div>
                    <Skeleton className="h-7 w-2/5" />
                    <Skeleton className="h-3 w-4/5" />
                    <Skeleton className="h-3 w-3/5" />
                    <Skeleton className="mt-auto h-16 w-full" />
                  </div>
                )}

                {previewState === 'error' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                    <CircleAlert className="size-5 text-zinc-400" />
                    <p className="mt-3 text-sm font-medium text-zinc-200">Preview is taking longer than expected</p>
                    <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-500">The deployment succeeded, but its public URL is not ready in this browser yet.</p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={retryPreview}>
                      <RefreshCw data-icon="inline-start" />
                      Retry preview
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Next Steps - inside Card */}
            <div className="flex flex-col px-6 pb-6 pt-5">
              <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-500">Next steps</h3>
              
              <div className="flex flex-col divide-y divide-zinc-800/70">
                <a href={siteUrl(project?.subdomain || "")} target="_blank" rel="noreferrer" className="group -mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-center justify-between rounded-md px-2 py-2.5 transition-colors hover:bg-zinc-900/70">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/80 text-zinc-400 transition-colors group-hover:border-zinc-700 group-hover:text-zinc-200">
                      <ExternalLink className="size-4" />
                    </div>
                    <div className="flex flex-col text-left">
                      <p className="text-[13px] font-medium text-zinc-200 group-hover:text-white">Preview website</p>
                      <p className="mt-0.5 text-xs text-zinc-500">View your live deployment in a new tab</p>
                    </div>
                  </div>
                  <ArrowRight className="size-4 text-zinc-600 transition-all group-hover:translate-x-0.5 group-hover:text-zinc-400" />
                </a>

                <button onClick={() => router.push(`/projects/${project?.id}`)} className="group -mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-center justify-between rounded-md px-2 py-2.5 transition-colors hover:bg-zinc-900/70">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/80 text-zinc-400 transition-colors group-hover:border-zinc-700 group-hover:text-zinc-200">
                      <Globe className="size-4" />
                    </div>
                    <div className="flex flex-col text-left">
                      <p className="text-[13px] font-medium text-zinc-200 group-hover:text-white">Add domain</p>
                      <p className="mt-0.5 text-xs text-zinc-500">Add a custom domain to your project</p>
                    </div>
                  </div>
                  <ArrowRight className="size-4 text-zinc-600 transition-all group-hover:translate-x-0.5 group-hover:text-zinc-400" />
                </button>

                <button onClick={() => router.push(`/projects/${project?.id}`)} className="group -mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-center justify-between rounded-md px-2 py-2.5 transition-colors hover:bg-zinc-900/70">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/80 text-zinc-400 transition-colors group-hover:border-zinc-700 group-hover:text-zinc-200">
                      <Activity className="size-4" />
                    </div>
                    <div className="flex flex-col text-left">
                      <p className="text-[13px] font-medium text-zinc-200 group-hover:text-white">Enable Observability</p>
                      <p className="mt-0.5 text-xs text-zinc-500">Monitor logs, metrics and deployment health</p>
                    </div>
                  </div>
                  <ArrowRight className="size-4 text-zinc-600 transition-all group-hover:translate-x-0.5 group-hover:text-zinc-400" />
                </button>
              </div>

              {/* CTA Button */}
              <Button 
                onClick={() => router.push(`/projects/${project?.id}`)}
                className="mt-5 flex h-10 w-full items-center justify-center rounded-md bg-white text-[13px] font-medium text-black transition-colors hover:bg-zinc-200"
              >
                Continue to project
              </Button>
            </div>
          </Card>
        </div>
      )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
