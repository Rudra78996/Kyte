"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FaGithub, FaLock } from "react-icons/fa";
import { Box, GitBranch, Search, Settings2, Plus, ArrowRight } from "lucide-react";
import { useApiRequest, useApiToken } from "@/hooks/use-api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export default function NewProjectPage() {
  const [step, setStep] = useState(1);
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUsername, setGithubUsername] = useState("");
  const [repos, setRepos] = useState<any[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [searchRepo, setSearchRepo] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [projectName, setProjectName] = useState("");
  
  // Build and Output settings
  const [preset, setPreset] = useState("React");
  const [rootDirectory, setRootDirectory] = useState("./");
  const [buildCommand, setBuildCommand] = useState("npm run build");
  const [outputDirectory, setOutputDirectory] = useState("dist");
  const [branch, setBranch] = useState("main");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const apiRequest = useApiRequest();
  const getClerkToken = useApiToken();
  const router = useRouter();

  const [project, setProject] = useState<any>(null);
  const [activeDeploy, setActiveDeploy] = useState<any>(null);
  const [deployStatus, setDeployStatus] = useState<'QUEUED' | 'BUILDING' | 'SUCCESS' | 'FAILED'>('QUEUED');
  const [logs, setLogs] = useState<{ stream: string; text: string }[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    checkGithubConnection();
  }, []);

  const checkGithubConnection = async () => {
    try {
      setLoadingRepos(true);
      const user = await apiRequest("GET", "/auth/me");
      if (user.githubConnected) {
        setGithubConnected(true);
        setGithubUsername(user.githubUsername);
        fetchGithubRepos();
      } else {
        setLoadingRepos(false);
      }
    } catch (err) {
      setLoadingRepos(false);
    }
  };

  const fetchGithubRepos = async () => {
    try {
      const data = await apiRequest("GET", "/auth/github/repos");
      setRepos(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRepos(false);
    }
  };

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
    } catch (err: any) {
      setError(err.message || "Failed to connect GitHub");
    }
  };

  useEffect(() => {
    if (!activeDeploy || step !== 3) return;
    let es: EventSource;
    (async () => {
      const token = await getClerkToken();
      if (!token) return;
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost/api';
      es = new EventSource(`${API_BASE}/projects/${project?.id}/deployments/${activeDeploy.id}/logs?token=${token}`);
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLogs(prev => [...prev, data]);
          
          setDeployStatus(prev => prev === 'QUEUED' ? 'BUILDING' : prev);

          if (data.text.includes('Deploy complete.')) {
             setDeployStatus('SUCCESS');
             setStep(4);
             es.close();
          } else if (data.text.includes('Build failed:')) {
             setDeployStatus('FAILED');
             setError("Deployment failed. Please check the logs.");
             es.close();
          }
        } catch (e) {}
      };
    })();
    return () => es?.close();
  }, [activeDeploy?.id, step]);

  const handleDeploy = async () => {
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
        branch
      });
      setProject(proj);

      const deployRes = await apiRequest('POST', `/projects/${proj.id}/deployments`, {
        repoUrl: proj.repoUrl, branch: proj.branch || 'main', commitSha: 'HEAD',
      });
      setActiveDeploy(deployRes);
      
      setStep(3);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Failed to deploy project");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Let's build something new.</h1>
        <p className="text-muted-foreground">
          To deploy a new Project, import an existing Git Repository or get started with a Template.
        </p>
      </div>

      {step === 1 && (
        <Card className="border-muted shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Import Git Repository</CardTitle>
            <CardDescription>Connect your GitHub account to import private repositories.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loadingRepos ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : !githubConnected ? (
              <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
                <FaGithub className="size-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Connect to GitHub</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
                  Connect your GitHub account to import and deploy your private repositories directly.
                </p>
                <Button onClick={handleConnectGithub}>
                  <FaGithub className="mr-2" /> Connect GitHub
                </Button>
                {error && <p className="text-sm text-destructive mt-4">{error}</p>}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-full">
                      <FaGithub className="size-5" />
                    </div>
                    <span className="text-sm font-medium">{githubUsername}</span>
                  </div>
                  <div className="relative w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input 
                      type="text" 
                      value={searchRepo}
                      onChange={e => setSearchRepo(e.target.value)}
                      placeholder="Search repositories..." 
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="flex flex-col max-h-[350px] overflow-y-auto pr-2 space-y-1">
                  {filteredRepos.length > 0 ? filteredRepos.map(repo => (
                    <div key={repo.id} className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                      <div className="flex items-center gap-3">
                        <Box className="size-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{repo.name}</span>
                        {repo.private && <FaLock className="size-3 text-muted-foreground" title="Private" />}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
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
            
            <div className="flex items-center gap-4 py-2">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">or</span>
              <Separator className="flex-1" />
            </div>
            
            <form onSubmit={handleImport} className="space-y-3">
              <Label htmlFor="import-url">Import Third-Party Git Repository</Label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input 
                    id="import-url"
                    type="url" 
                    required
                    value={importUrl}
                    onChange={e => setImportUrl(e.target.value)}
                    placeholder="https://github.com/user/repo" 
                    className="pl-9"
                  />
                </div>
                <Button type="submit" variant="secondary">
                  Import
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="col-span-1 lg:col-span-2 space-y-6">
            <Card className="border-muted shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl">Configure Project</CardTitle>
                <CardDescription>
                  You're importing <strong>{importUrl.replace('https://github.com/', '') || 'repository'}</strong>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="project-name">Project Name</Label>
                  <Input 
                    id="project-name"
                    type="text" 
                    value={projectName}
                    onChange={e => setProjectName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="branch">Production Branch</Label>
                  <Input 
                    id="branch"
                    type="text" 
                    value={branch}
                    onChange={e => setBranch(e.target.value)}
                    placeholder="main"
                  />
                  <p className="text-[13px] text-muted-foreground">The GitHub branch that will be deployed.</p>
                </div>

                <div className="space-y-2">
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
                    <SelectTrigger>
                      <SelectValue placeholder="Select a preset" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Next.js">Next.js (Static Export)</SelectItem>
                      <SelectItem value="React">React (Vite)</SelectItem>
                      <SelectItem value="Vue">Vue.js</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {preset === 'Next.js' && (
                    <p className="text-xs text-neutral-400 mt-2">
                      <strong>Note:</strong> Next.js projects must be configured for static export to work on this platform. Add <code className="text-primary bg-primary/10 px-1 py-0.5 rounded">output: 'export'</code> to your <code className="text-primary bg-primary/10 px-1 py-0.5 rounded">next.config.js</code> file.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Root Directory</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="text" 
                      value={rootDirectory}
                      onChange={e => setRootDirectory(e.target.value)}
                      placeholder="./"
                    />
                  </div>
                  <p className="text-[13px] text-muted-foreground">The directory within your project that contains the source code.</p>
                </div>

                <Accordion className="w-full border rounded-lg px-4">
                  <AccordionItem value="build-settings" className="border-none">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-2">
                        <Settings2 className="size-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Build and Output Settings</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pb-4">
                      <div className="space-y-2 pt-2">
                        <Label>Build Command</Label>
                        <Input 
                          type="text" 
                          value={buildCommand}
                          onChange={e => setBuildCommand(e.target.value)}
                          placeholder="npm run build"
                        />
                        <p className="text-[13px] text-muted-foreground">The command your framework uses to build your app.</p>
                      </div>
                      <div className="space-y-2 pt-2">
                        <Label>Output Directory</Label>
                        <Input 
                          type="text" 
                          value={outputDirectory}
                          onChange={e => setOutputDirectory(e.target.value)}
                          placeholder=".next, build, dist"
                        />
                        <p className="text-[13px] text-muted-foreground">The directory where your framework outputs its build.</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {error && <p className="text-sm text-destructive">{error}</p>}
              </CardContent>
              <CardFooter className="bg-muted/30 border-t px-6 py-4">
                <Button 
                  onClick={handleDeploy}
                  disabled={loading}
                  className="w-full sm:w-auto"
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

          <div className="col-span-1">
            <Card className="border-muted shadow-sm overflow-hidden h-full">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-lg">Deployment Summary</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex flex-col items-center justify-center py-6">
                  <div className="size-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border shadow-inner mb-4">
                    <Box className="size-8 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">{projectName || "New Project"}</h3>
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <GitBranch className="size-3.5" />
                    <span>main</span>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Preset</span>
                    <span className="font-medium">{preset}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Root Directory</span>
                    <span className="font-medium">{rootDirectory}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Build Command</span>
                    <span className="font-medium font-mono text-xs mt-0.5">{buildCommand || "None"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Output Dir</span>
                    <span className="font-medium font-mono text-xs mt-0.5">{outputDirectory || "None"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {step === 3 && (
        <Card className="border-muted shadow-sm overflow-hidden min-h-[500px] flex flex-col">
          <CardHeader className="bg-muted/40 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl">Deploying {projectName}</CardTitle>
              <CardDescription>We are building and deploying your project.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`font-mono text-[10px] ${
                deployStatus === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50' :
                deployStatus === 'FAILED' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50' :
                deployStatus === 'BUILDING' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50' :
                'bg-neutral-50 text-neutral-700 border-neutral-200 dark:bg-neutral-900 dark:text-neutral-400 dark:border-neutral-800'
              }`}>
                {deployStatus}
              </Badge>
              {(deployStatus === 'QUEUED' || deployStatus === 'BUILDING') && (
                <div className="size-3.5 rounded-full border-2 border-t-transparent border-primary animate-spin" />
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 flex flex-col bg-[#0a0a0a]">
            <div className="flex-1 p-4 font-mono text-xs leading-relaxed text-neutral-300 overflow-y-auto max-h-[600px]">
              {logs.length === 0 && <div className="text-neutral-500 italic">Waiting for logs...</div>}
              {logs.map((log, i) => (
                <div key={i} className={`break-words mb-1 ${log.stream === 'STDERR' ? 'text-red-400' : 'text-neutral-300'}`}>
                  {log.text}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </CardContent>
          <CardFooter className="bg-muted/30 border-t p-4 flex justify-end">
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
      )}

      {step === 4 && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-2 mb-8 animate-in slide-in-from-bottom-4 duration-700 fade-in">
            <h2 className="text-3xl font-bold tracking-tight">Congratulations!</h2>
            <p className="text-muted-foreground">You just deployed a new project to Kyte.</p>
          </div>

          <Card className="border-muted shadow-lg overflow-hidden animate-in zoom-in-95 duration-700 fade-in">
            <div className="bg-muted/40 p-3 border-b flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="size-3 rounded-full bg-red-500/80" />
                <div className="size-3 rounded-full bg-yellow-500/80" />
                <div className="size-3 rounded-full bg-green-500/80" />
              </div>
              <div className="mx-auto bg-background/50 px-3 py-1 rounded-md text-xs font-medium text-muted-foreground border shadow-sm">
                {project?.subdomain}.localhost
              </div>
            </div>
            <div className="w-full h-[500px] bg-background relative">
              <iframe 
                src={`http://${project?.subdomain}.localhost`} 
                className="w-full h-full border-none"
                title="Project Preview"
              />
            </div>
            <CardFooter className="bg-muted/10 p-6 flex flex-col gap-4">
              <Button 
                onClick={() => router.push(`/projects/${project?.id}`)}
                className="w-full py-6 text-base font-medium shadow-sm hover:shadow transition-all"
              >
                Continue to Dashboard <ArrowRight className="ml-2 size-4" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
