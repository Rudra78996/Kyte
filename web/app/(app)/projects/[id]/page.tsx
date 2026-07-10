"use client";

import { useEffect, useState, useRef } from 'react';
import { useApiRequest, useApiToken } from '@/hooks/use-api';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, RefreshCw, Terminal, GitBranch } from 'lucide-react';

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;
  const apiRequest = useApiRequest();
  const getClerkToken = useApiToken();

  const [project, setProject] = useState<any>(null);
  const [deployments, setDeployments] = useState<any[]>([]);
  const [activeDeploy, setActiveDeploy] = useState<any>(null);
  const [logs, setLogs] = useState<{ stream: string; text: string }[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [projectId]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const loadData = async () => {
    try {
      const proj = await apiRequest('GET', `/projects`);
      const found = proj.projects.find((p: any) => p.id === projectId);
      setProject(found);
      const deps = await apiRequest('GET', `/projects/${projectId}/deployments`);
      setDeployments(deps.deployments || []);
      if (deps.deployments.length > 0) {
        setActiveDeploy((prev: any) => prev ? prev : deps.deployments[0]);
      }
    } catch (err) { console.error(err); }
  };

  const triggerDeploy = async () => {
    try {
      const res = await apiRequest('POST', `/projects/${projectId}/deployments`, {
        repoUrl: project.repoUrl, branch: 'main', commitSha: 'HEAD',
      });
      setActiveDeploy(res);
      setLogs([]);
      loadData();
    } catch (err: any) { alert(err.message); }
  };

  const [enablingWebhook, setEnablingWebhook] = useState(false);
  const enableWebhook = async () => {
    setEnablingWebhook(true);
    try {
      const res = await apiRequest('POST', `/projects/${projectId}/webhook/enable`);
      alert(res.message || 'Webhook enabled!');
      loadData();
    } catch (err: any) { alert(err.message || 'Failed'); }
    finally { setEnablingWebhook(false); }
  };

  useEffect(() => {
    if (!activeDeploy) return;
    let es: EventSource;
    (async () => {
      const token = await getClerkToken();
      if (!token) return;
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost/api';
      es = new EventSource(`${API_BASE}/projects/${projectId}/deployments/${activeDeploy.id}/logs?token=${token}`);
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLogs(prev => [...prev, data]);
          if (data.text.includes('Deploy complete.') || data.text.includes('Build failed:')) loadData();
        } catch (e) {}
      };
    })();
    return () => es?.close();
  }, [activeDeploy?.id]);

  if (!project) return <div className="py-24 text-center text-muted-foreground animate-pulse">Loading…</div>;

  const statusVariant: Record<string, string> = {
    SUCCESS:  'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50',
    FAILED:   'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50',
    BUILDING: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50',
    QUEUED:   'bg-neutral-50 text-neutral-700 border-neutral-200 dark:bg-neutral-900 dark:text-neutral-400 dark:border-neutral-800',
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0 w-full">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          <a
            href={`http://${project.subdomain}.localhost`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors mt-1"
          >
            {project.subdomain}.localhost <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="flex items-center gap-3">
          {project.webhookId ? (
            <Badge variant="outline" className="px-3 py-1.5 text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-900/50 dark:bg-emerald-950/20 text-sm font-normal">
              ✓ Auto-Deploy Active
            </Badge>
          ) : (
            <Button onClick={enableWebhook} disabled={enablingWebhook} variant="outline" className="h-9">
              {enablingWebhook ? 'Enabling…' : 'Enable Auto-Deploy'}
            </Button>
          )}
          <Button onClick={triggerDeploy} className="h-9 gap-2">
            <RefreshCw className="w-4 h-4" /> Trigger Deploy
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Terminal logs */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <Card className="flex flex-col overflow-hidden shadow-sm flex-1 min-h-[600px] max-h-[800px]">
            <div className="border-b bg-muted/40 py-2.5 px-4 flex justify-between items-center">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Terminal className="w-4 h-4" /> Build Logs
              </div>
              <Badge variant="outline" className={`font-mono text-[10px] ${statusVariant[activeDeploy?.status] ?? ''}`}>
                {activeDeploy?.status || 'UNKNOWN'}
              </Badge>
            </div>
            <div className="flex-1 p-4 font-mono text-xs leading-relaxed bg-[#0a0a0a] text-neutral-300 overflow-y-auto">
              {logs.length === 0 && <div className="text-neutral-500 italic">Waiting for logs…</div>}
              {logs.map((log, i) => (
                <div key={i} className={`break-words mb-1 ${log.stream === 'STDERR' ? 'text-red-400' : 'text-neutral-300'}`}>
                  {log.text}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
            
            <div className="p-3 border-t flex justify-between items-center bg-muted/20">
              <span className="text-xs text-muted-foreground">
                Deployed {activeDeploy?.deployedAt ? new Date(activeDeploy.deployedAt).toLocaleString() : 'N/A'} via {activeDeploy?.triggerSource}
              </span>
              <a href={`http://${activeDeploy?.id}.localhost`} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm" className="gap-2 text-xs h-7">
                  Preview URL <ExternalLink className="w-3 h-3" />
                </Button>
              </a>
            </div>
          </Card>
        </div>

        {/* Right: History List */}
        <div className="lg:col-span-1 min-h-0 flex flex-col">
          <Card className="flex flex-col overflow-hidden shadow-sm flex-1 min-h-[600px] max-h-[800px]">
            <CardHeader className="py-4 border-b bg-muted/20 shrink-0">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                Deployment History
                <Badge variant="secondary" className="rounded-full text-xs font-normal">
                  {deployments.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {deployments.map(d => (
                <button
                  key={d.id}
                  onClick={() => { setActiveDeploy(d); setLogs([]); }}
                  className={`w-full text-left p-3 rounded-lg transition-all flex flex-col gap-2 border ${
                    activeDeploy?.id === d.id 
                      ? 'bg-primary/5 border-primary/20 ring-1 ring-primary/10 shadow-sm' 
                      : 'border-transparent hover:bg-muted/50 hover:border-border'
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-mono text-sm font-bold">{d.commitSha.slice(0, 7)}</span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] uppercase ${statusVariant[d.status] ?? ''}`}>
                      {d.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center w-full">
                    <span className="text-xs text-muted-foreground">
                      {new Date(d.deployedAt).toLocaleDateString(undefined, { 
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
                      })}
                    </span>
                    {d.triggerSource === 'WEBHOOK' && (
                      <span className="text-[10px] bg-secondary/80 px-1.5 py-0.5 rounded-sm text-secondary-foreground font-medium">Auto</span>
                    )}
                  </div>
                </button>
              ))}
              {deployments.length === 0 && (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No deployments found.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
