"use client";

import { useEffect, useState, useRef } from 'react';
import { request, getToken } from '@/lib/api';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<any>(null);
  const [deployments, setDeployments] = useState<any[]>([]);
  const [activeDeploy, setActiveDeploy] = useState<any>(null);
  
  const [logs, setLogs] = useState<{stream: string, text: string}[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
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
    } catch (err) {
      console.error(err);
    }
  };

  const triggerDeploy = async () => {
    try {
      const res = await request('POST', `/projects/${projectId}/deployments`, {
        repoUrl: project.repoUrl,
        branch: 'main',
        commitSha: 'HEAD'
      });
      setActiveDeploy(res);
      setLogs([]);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  useEffect(() => {
    if (!activeDeploy || !getToken()) return;

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost/api';
    const eventSource = new EventSource(`${API_BASE}/projects/${projectId}/deployments/${activeDeploy.id}/logs?token=${getToken()}`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLogs(prev => [...prev, data]);
        if (data.text.includes('Deploy complete.') || data.text.includes('Build failed:')) {
           loadData();
        }
      } catch(e) {}
    };

    return () => {
      eventSource.close();
    };
  }, [activeDeploy?.id]);

  if (!project) return <div className="py-24 text-center text-slate-500 animate-pulse">Loading project details...</div>;

  return (
    <div className="max-w-7xl mx-auto py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <Link href="/dashboard" className="text-sm text-slate-400 hover:text-slate-300 transition-colors mb-2 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            {project.name}
          </h1>
          <a 
            href={`http://${project.subdomain}.localhost`} 
            target="_blank" 
            rel="noreferrer" 
            className="text-sm text-blue-400 hover:text-blue-300 mt-1 inline-block"
          >
            {project.subdomain}.localhost
          </a>
        </div>
        <Button onClick={triggerDeploy} className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
          Trigger Deployment
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-lg font-semibold text-slate-200">Deployments History</h3>
          <div className="space-y-3">
            {deployments.map(d => (
              <Card 
                key={d.id} 
                className={`bg-slate-900 border-slate-800 transition-colors cursor-pointer hover:bg-slate-800/80 ${activeDeploy?.id === d.id ? 'ring-1 ring-blue-500 bg-slate-800/50' : ''}`}
                onClick={() => { setActiveDeploy(d); setLogs([]); }}
              >
                <CardHeader className="p-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-mono font-medium text-slate-200">{d.commitSha.slice(0, 7)}</span>
                    <Badge variant="outline" className={
                      d.status === 'SUCCESS' ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/50' : 
                      d.status === 'FAILED' ? 'bg-red-950/30 text-red-400 border-red-900/50' : 
                      d.status === 'BUILDING' ? 'bg-blue-950/30 text-blue-400 border-blue-900/50' : 
                      'bg-slate-800 text-slate-300 border-slate-700'
                    }>
                      {d.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {new Date(d.deployedAt).toLocaleString()}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          <Card className="bg-slate-900 border-slate-800 flex flex-col overflow-hidden shadow-xl" style={{ height: 'calc(100vh - 250px)', minHeight: '500px' }}>
            <CardHeader className="border-b border-slate-800 bg-slate-950/50 py-3 px-4 flex-row justify-between items-center space-y-0">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                </div>
                <CardTitle className="text-sm font-medium text-slate-300">Build Terminal</CardTitle>
              </div>
              {activeDeploy && (
                <Badge variant="outline" className="bg-slate-800/50 border-slate-700 font-mono text-xs text-slate-400">
                  {activeDeploy.commitSha.slice(0, 7)}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden bg-[#0A0A0A] relative">
              <div className="absolute inset-0 overflow-y-auto p-4 font-mono text-xs sm:text-sm leading-relaxed">
                {logs.length === 0 && <div className="text-slate-500">Waiting for logs to stream...</div>}
                {logs.map((log, i) => (
                  <div key={i} className={`break-words ${log.stream === 'STDERR' ? 'text-red-400' : 'text-slate-300'}`}>
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
