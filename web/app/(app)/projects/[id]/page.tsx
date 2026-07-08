"use client";

import { useEffect, useState, useRef } from 'react';
import { request, getToken } from '@/lib/api';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;

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
      const proj = await request('GET', `/projects`);
      const found = proj.projects.find((p: any) => p.id === projectId);
      setProject(found);
      const deps = await request('GET', `/projects/${projectId}/deployments`);
      setDeployments(deps.deployments || []);
      if (deps.deployments.length > 0 && !activeDeploy) {
        setActiveDeploy(deps.deployments[0]);
      }
    } catch (err) { console.error(err); }
  };

  const triggerDeploy = async () => {
    try {
      const res = await request('POST', `/projects/${projectId}/deployments`, {
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
      const res = await request('POST', `/projects/${projectId}/webhook/enable`);
      alert(res.message || 'Webhook enabled!');
      loadData();
    } catch (err: any) { alert(err.message || 'Failed'); }
    finally { setEnablingWebhook(false); }
  };

  useEffect(() => {
    if (!activeDeploy || !getToken()) return;
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost/api';
    const es = new EventSource(`${API_BASE}/projects/${projectId}/deployments/${activeDeploy.id}/logs?token=${getToken()}`);
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLogs(prev => [...prev, data]);
        if (data.text.includes('Deploy complete.') || data.text.includes('Build failed:')) loadData();
      } catch (e) {}
    };
    return () => es.close();
  }, [activeDeploy?.id]);

  if (!project) return <div className="py-24 text-center text-muted-foreground animate-pulse">Loading…</div>;

  const statusVariant: Record<string, string> = {
    SUCCESS:  'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50',
    FAILED:   'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50',
    BUILDING: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50',
    QUEUED:   '',
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          <a
            href={`http://${project.subdomain}.localhost`}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-mono text-muted-foreground hover:text-foreground transition-colors mt-1 inline-block"
          >
            {project.subdomain}.localhost ↗
          </a>
        </div>
        <div className="flex gap-2">
          {project.webhookId ? (
            <Button disabled variant="outline" size="sm" className="text-emerald-600 border-emerald-200 bg-emerald-50 opacity-100 cursor-default dark:text-emerald-400 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              ✓ Auto-Deploy On
            </Button>
          ) : (
            <Button onClick={enableWebhook} disabled={enablingWebhook} variant="outline" size="sm">
              {enablingWebhook ? 'Enabling…' : 'Enable Auto-Deploy'}
            </Button>
          )}
          <Button onClick={triggerDeploy} size="sm">Trigger Deploy</Button>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Deployment history */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">History</h3>
          <div className="space-y-2">
            {deployments.map(d => (
              <Card
                key={d.id}
                className={`cursor-pointer transition-colors hover:bg-accent/40 ${activeDeploy?.id === d.id ? 'ring-2 ring-ring' : ''}`}
                onClick={() => { setActiveDeploy(d); setLogs([]); }}
              >
                <CardHeader className="p-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{d.commitSha.slice(0, 7)}</span>
                      {d.triggerSource === 'WEBHOOK' && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1">Auto</Badge>
                      )}
                    </div>
                    <Badge variant="outline" className={statusVariant[d.status] ?? ''}>
                      {d.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs mt-1">
                    {new Date(d.deployedAt).toLocaleString()}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
            {deployments.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No deployments yet.</p>
            )}
          </div>
        </div>

        {/* Build terminal */}
        <div className="lg:col-span-2">
          <Card className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 300px)', minHeight: '450px' }}>
            <CardHeader className="border-b bg-muted/40 py-3 px-4 flex-row justify-between items-center space-y-0">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400/50 border border-red-400/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400/50 border border-yellow-400/70" />
                  <div className="w-3 h-3 rounded-full bg-green-400/50 border border-green-400/70" />
                </div>
                <CardTitle className="text-xs font-medium text-muted-foreground">Build Terminal</CardTitle>
              </div>
              {activeDeploy && (
                <Badge variant="outline" className="font-mono text-[10px]">
                  {activeDeploy.commitSha.slice(0, 7)}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden bg-[#0A0A0A]">
              <div className="absolute inset-0 overflow-y-auto p-4 font-mono text-xs leading-relaxed" style={{ position: 'relative' }}>
                {logs.length === 0 && <div className="text-neutral-500">Waiting for logs…</div>}
                {logs.map((log, i) => (
                  <div key={i} className={`break-words ${log.stream === 'STDERR' ? 'text-red-400' : 'text-neutral-300'}`}>
                    {log.text}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
