"use client";

import { useEffect, useState, useRef } from 'react';
import { useApiRequest, useApiToken } from '@/hooks/use-api';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Terminal, GitBranch, Settings, Activity, Clock, Zap, ChevronRight, Circle, Globe, Box, Copy, MoreVertical, Search, ChevronDown, Rocket, RefreshCw, XCircle } from 'lucide-react';

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const apiRequest = useApiRequest();
  const getClerkToken = useApiToken();

  const [project, setProject] = useState<any>(null);
  const [deployments, setDeployments] = useState<any[]>([]);
  const [activeDeploy, setActiveDeploy] = useState<any>(null);
  const [logs, setLogs] = useState<{ stream: string; text: string }[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<string>("Deployments");

  const [settingsForm, setSettingsForm] = useState<any>({
    name: '', branch: '', rootDirectory: '', buildCommand: '', outputDirectory: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [projectId]);

  useEffect(() => {
    if (activeTab === "Logs") {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);

  const loadData = async () => {
    try {
      const proj = await apiRequest('GET', `/projects`);
      const found = proj.projects.find((p: any) => p.id === projectId);
      setProject(found);
      
      setSettingsForm((prev: any) => ({
        name: prev.name || found.name || '',
        branch: prev.branch || found.branch || '',
        rootDirectory: prev.rootDirectory || found.rootDirectory || '',
        buildCommand: prev.buildCommand || found.buildCommand || '',
        outputDirectory: prev.outputDirectory || found.outputDirectory || '',
      }));

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
        repoUrl: project.repoUrl, branch: project.branch || 'main', commitSha: 'HEAD',
      });
      setActiveDeploy(res);
      setLogs([]);
      setActiveTab("Logs");
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

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      await apiRequest('PATCH', `/projects/${projectId}`, settingsForm);
      alert('Settings saved successfully!');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteProject = async () => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) return;
    try {
      await apiRequest('DELETE', `/projects/${projectId}`);
      router.push('/dashboard');
    } catch (err: any) {
      alert(err.message || 'Failed to delete project');
    }
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

  if (!project) return <div className="min-h-screen bg-[#000] text-gray-100 py-24 text-center animate-pulse">Loading…</div>;

  const tabs = ["Deployments", "Analytics", "Logs", "Environment", "Domains", "Settings"];

  const renderStatusBadge = (status: string) => {
    if (status === 'SUCCESS') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111] border border-[#222] text-[#00E599] text-xs font-medium">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00E599]" />
          Ready
        </div>
      );
    }
    if (status === 'FAILED') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111] border border-[#222] text-[#FF5555] text-xs font-medium">
          <XCircle className="w-3 h-3 text-[#FF5555]" />
          Error
        </div>
      );
    }
    if (status === 'BUILDING') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111] border border-[#222] text-[#F5A623] text-xs font-medium animate-pulse">
          <Circle className="w-1.5 h-1.5 rounded-full bg-[#F5A623]" fill="currentColor" />
          Building
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111] border border-[#222] text-gray-400 text-xs font-medium">
        <Circle className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        Queued
      </div>
    );
  };

  const currentDeployStatus = activeDeploy?.status || 'UNKNOWN';
  const isLatestDeployReady = deployments.length > 0 && deployments[0].status === 'SUCCESS';

  return (
    <div className="min-h-screen bg-[#000] text-gray-100 font-sans selection:bg-[#fff] selection:text-[#000] pb-24">
      {/* Top Navbar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-[#1E1E1E]">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer" onClick={() => router.push('/dashboard')}>
            <span className="font-semibold text-gray-300">Kyte</span>
          </div>
          <ChevronRight className="w-4 h-4" />
          <div className="flex items-center gap-2 font-medium text-gray-100">
            {project.name}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={triggerDeploy} variant="outline" className="h-8 px-3 text-xs bg-transparent border-[#333] hover:bg-[#111] hover:text-white text-gray-300 transition-colors">
            <RefreshCw className="w-3.5 h-3.5 mr-2" /> Redeploy
          </Button>
          <a href={`http://${project.subdomain}.localhost`} target="_blank" rel="noreferrer">
            <Button className="h-8 px-3 text-xs bg-white text-black hover:bg-gray-200 transition-colors">
              <ExternalLink className="w-3.5 h-3.5 mr-2" /> Visit
            </Button>
          </a>
        </div>
      </div>

      <div className="px-8 mt-12 max-w-[1600px] mx-auto w-full">
        {/* Hero Header */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-12 w-full">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl border border-[#333] bg-gradient-to-br from-[#111] to-[#050505] flex items-center justify-center shrink-0 shadow-2xl">
              <Zap className="w-8 h-8 text-[#F5A623]" fill="currentColor" />
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-white">{project.name}</h1>
                {isLatestDeployReady ? (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#111] border border-[#222] text-[#00E599] text-[11px] font-semibold tracking-wide uppercase">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00E599]" /> Ready
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#111] border border-[#222] text-[#F5A623] text-[11px] font-semibold tracking-wide uppercase">
                    <Circle className="w-1.5 h-1.5 rounded-full bg-[#F5A623]" fill="currentColor" /> Building
                  </div>
                )}
                <Badge variant="outline" className="px-2 py-0 text-[11px] font-mono border-[#333] text-gray-400 bg-transparent rounded-sm">Next.js</Badge>
                <Badge variant="outline" className="px-2 py-0 text-[11px] font-mono border-[#333] text-gray-400 bg-transparent rounded-sm">React</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                <a href={`http://${project.subdomain}.localhost`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors">
                  <Globe className="w-3.5 h-3.5" />
                  {project.subdomain}.localhost <ExternalLink className="w-3 h-3" />
                </a>
                <div className="flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5" /> {project.branch || 'main'}
                </div>
                {activeDeploy && (
                  <div className="flex items-center gap-1.5 font-mono">
                    {activeDeploy.commitSha?.slice(0, 7)}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Last deployed {deployments.length > 0 ? 'recently' : 'never'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 xl:justify-end">
            <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#222] bg-[#0A0A0A] min-w-[110px]">
              <span className="text-xl font-bold text-[#7B7BFF] tracking-tight">2.4M</span>
              <span className="text-[11px] text-gray-500 font-medium">Requests</span>
            </div>
            <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#222] bg-[#0A0A0A] min-w-[110px]">
              <span className="text-xl font-bold text-[#00E599] tracking-tight">99.98%</span>
              <span className="text-[11px] text-gray-500 font-medium">Uptime</span>
            </div>
            <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#222] bg-[#0A0A0A] min-w-[110px]">
              <span className="text-xl font-bold text-[#F5A623] tracking-tight">84ms</span>
              <span className="text-[11px] text-gray-500 font-medium">Avg. resp.</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-8 border-b border-[#222] mb-8 overflow-x-auto hide-scrollbar w-full">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium transition-colors relative whitespace-nowrap flex items-center gap-2 ${
                activeTab === tab ? 'text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab === 'Deployments' && <Zap className="w-4 h-4" />}
              {tab === 'Analytics' && <Activity className="w-4 h-4" />}
              {tab === 'Logs' && <Terminal className="w-4 h-4" />}
              {tab === 'Environment' && <Box className="w-4 h-4" />}
              {tab === 'Domains' && <Globe className="w-4 h-4" />}
              {tab === 'Settings' && <Settings className="w-4 h-4" />}
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-t-full shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "Deployments" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full">
            {/* Left: Deployment List */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Deployment History</h2>
                <Button variant="outline" className="h-8 px-3 text-xs bg-transparent border-[#333] text-gray-300 hover:bg-[#111]">
                  All branches <ChevronDown className="w-3.5 h-3.5 ml-2" />
                </Button>
              </div>

              <div className="flex flex-col gap-3">
                {deployments.map((d, index) => {
                  const isCurrent = index === 0 && d.status === 'SUCCESS';
                  const isActiveView = activeDeploy?.id === d.id;
                  return (
                    <div
                      key={d.id}
                      onClick={() => { setActiveDeploy(d); setLogs([]); }}
                      className={`group flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                        isActiveView 
                          ? 'bg-[#111] border-[#444] shadow-[0_0_15px_rgba(0,0,0,0.5)]' 
                          : 'bg-[#0A0A0A] border-[#1E1E1E] hover:border-[#333] hover:bg-[#0f0f0f]'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-inner">
                          {project.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-sm text-gray-100 group-hover:text-white transition-colors">
                              Deployment: {d.commitSha.slice(0, 7)}
                            </span>
                            {isCurrent && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-[#1A1A40] text-[#7B7BFF] border border-[#2a2a60]">
                                CURRENT
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500 font-mono">
                            <div className="flex items-center gap-1.5">
                              <GitBranch className="w-3 h-3" /> {d.branch || 'main'}
                            </div>
                            <span>{d.commitSha.slice(0, 7)}</span>
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3 h-3" /> 
                              {new Date(d.deployedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {renderStatusBadge(d.status)}
                      </div>
                    </div>
                  );
                })}
                {deployments.length === 0 && (
                  <div className="text-center py-12 border border-[#1E1E1E] rounded-xl bg-[#0A0A0A] text-gray-500 text-sm">
                    No deployments found. Trigger a deploy to see history here.
                  </div>
                )}
              </div>
            </div>

            {/* Right: Sidebar */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* Current Deployment Config */}
              <div className="border border-[#1E1E1E] rounded-xl bg-[#0A0A0A] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#1E1E1E]">
                  <h3 className="text-xs font-bold text-gray-400 tracking-widest uppercase">Current Deployment</h3>
                </div>
                <div className="p-4 flex flex-col gap-4 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Status</span>
                    {renderStatusBadge(currentDeployStatus)}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Region</span>
                    <span className="text-gray-200 font-mono text-[11px] tracking-tight">iad1 · fra1 · sin1</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Runtime</span>
                    <span className="text-gray-200 font-mono text-[11px] tracking-tight">Node.js 22.x</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Build</span>
                    <span className="text-gray-200 font-mono text-[11px] tracking-tight">48s</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Size</span>
                    <span className="text-gray-200 font-mono text-[11px] tracking-tight">4.2 MB</span>
                  </div>
                </div>
              </div>

              {/* Build Configuration */}
              <div className="border border-[#1E1E1E] rounded-xl bg-[#0A0A0A] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#1E1E1E]">
                  <h3 className="text-xs font-bold text-gray-400 tracking-widest uppercase">Build Configuration</h3>
                </div>
                <div className="p-4 flex flex-col gap-4 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Framework</span>
                    <span className="text-gray-200 font-mono text-[11px] tracking-tight bg-[#111] px-1.5 py-0.5 rounded border border-[#222]">{project.preset || 'Next.js'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Build cmd</span>
                    <span className="text-gray-200 font-mono text-[11px] tracking-tight bg-[#111] px-1.5 py-0.5 rounded border border-[#222]">{project.buildCommand || 'npm run build'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Output dir</span>
                    <span className="text-gray-200 font-mono text-[11px] tracking-tight bg-[#111] px-1.5 py-0.5 rounded border border-[#222]">{project.outputDirectory || '.next'}</span>
                  </div>
                </div>
              </div>

              {/* Domains */}
              <div className="border border-[#1E1E1E] rounded-xl bg-[#0A0A0A] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#1E1E1E]">
                  <h3 className="text-xs font-bold text-gray-400 tracking-widest uppercase">Domains</h3>
                </div>
                <div className="p-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                      <span className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">{project.subdomain}.localhost</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-[#1A1A40] text-[#7B7BFF] border border-[#2a2a60]">Primary</span>
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00E599]" />
                  </div>
                  <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                      <span className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">www.{project.subdomain}.localhost</span>
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00E599]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === "Logs" && (
          <div className="flex flex-col border border-[#1E1E1E] rounded-xl bg-[#000] overflow-hidden shadow-2xl h-[700px] w-full">
            <div className="border-b border-[#1E1E1E] bg-[#0A0A0A] py-3 px-5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <Terminal className="w-4 h-4 text-gray-400" /> 
                <span className="text-sm font-semibold text-gray-200">Build Output</span>
                <span className="text-gray-500 font-mono text-xs">({activeDeploy?.commitSha?.slice(0,7)})</span>
              </div>
              {renderStatusBadge(activeDeploy?.status)}
            </div>
            
            <div className="flex-1 p-5 font-mono text-sm leading-relaxed bg-[#000] text-gray-300 overflow-y-auto">
              {logs.length === 0 && <div className="text-gray-600 italic flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Waiting for logs…</div>}
              {logs.map((log, i) => (
                <div key={i} className={`break-words mb-1 ${log.stream === 'STDERR' ? 'text-[#FF5555]' : 'text-gray-300'}`}>
                  {log.text}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
            
            <div className="p-4 border-t border-[#1E1E1E] bg-[#0A0A0A] flex justify-between items-center shrink-0">
              <span className="text-xs text-gray-400 font-medium">
                Deployed via {activeDeploy?.triggerSource || 'API'}
              </span>
              <a href={`http://${activeDeploy?.id}.localhost`} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm" className="h-8 px-3 text-xs bg-[#111] border-[#333] hover:bg-[#222] hover:text-white text-gray-300">
                  Preview Deployment <ExternalLink className="w-3.5 h-3.5 ml-2" />
                </Button>
              </a>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "Settings" && (
          <div className="flex flex-col gap-10 max-w-5xl w-full mx-auto">
            {/* General Settings */}
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="w-full md:w-1/3 flex flex-col gap-2">
                <h2 className="text-lg font-semibold text-white">General Settings</h2>
                <p className="text-sm text-gray-500">View and update your project's general settings and repository connections.</p>
              </div>
              <div className="w-full md:w-2/3 border border-[#1E1E1E] rounded-xl bg-[#0A0A0A] overflow-hidden">
                <div className="p-6 flex flex-col gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-300">Project Name</label>
                    <input 
                      type="text"
                      className="w-full bg-[#000] border border-[#333] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-400 transition-colors"
                      value={settingsForm.name || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-300">Production Branch</label>
                    <input 
                      type="text"
                      className="w-full bg-[#000] border border-[#333] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-400 transition-colors"
                      value={settingsForm.branch || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, branch: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-300">Root Directory</label>
                    <input 
                      type="text"
                      placeholder="./"
                      className="w-full bg-[#000] border border-[#333] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-400 transition-colors"
                      value={settingsForm.rootDirectory || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, rootDirectory: e.target.value })}
                    />
                    <p className="text-xs text-gray-500 mt-1">The directory within your repository that contains your source code.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Build Settings */}
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="w-full md:w-1/3 flex flex-col gap-2">
                <h2 className="text-lg font-semibold text-white">Build & Development</h2>
                <p className="text-sm text-gray-500">Configure how your project is built and deployed.</p>
              </div>
              <div className="w-full md:w-2/3 border border-[#1E1E1E] rounded-xl bg-[#0A0A0A] overflow-hidden flex flex-col">
                <div className="p-6 flex flex-col gap-6 flex-1">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-300">Build Command</label>
                    <input 
                      type="text"
                      placeholder="npm run build"
                      className="w-full bg-[#000] border border-[#333] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-400 transition-colors font-mono"
                      value={settingsForm.buildCommand || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, buildCommand: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-300">Output Directory</label>
                    <input 
                      type="text"
                      placeholder=".next"
                      className="w-full bg-[#000] border border-[#333] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-400 transition-colors font-mono"
                      value={settingsForm.outputDirectory || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, outputDirectory: e.target.value })}
                    />
                  </div>
                </div>
                <div className="px-6 py-4 bg-[#111] border-t border-[#1E1E1E] flex justify-end">
                  <Button onClick={saveSettings} disabled={isSaving} className="bg-white text-black hover:bg-gray-200 font-medium">
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="flex flex-col md:flex-row gap-8 items-start mt-8">
              <div className="w-full md:w-1/3 flex flex-col gap-2">
                <h2 className="text-lg font-semibold text-[#FF5555]">Danger Zone</h2>
                <p className="text-sm text-gray-500">Irreversible and destructive actions.</p>
              </div>
              <div className="w-full md:w-2/3 border border-[#FF5555]/30 rounded-xl bg-[#1A0505] overflow-hidden">
                <div className="p-6 flex flex-col gap-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <h4 className="text-sm font-bold text-white">Auto-Deploy (Webhook)</h4>
                      <p className="text-xs text-gray-400">Currently {project.webhookId ? 'enabled' : 'disabled'}. Enables automatic deployments on git push.</p>
                    </div>
                    {!project.webhookId ? (
                      <Button onClick={enableWebhook} disabled={enablingWebhook} variant="outline" className="border-[#FF5555]/50 text-gray-300 hover:text-white hover:bg-[#FF5555]/20 shrink-0">
                        {enablingWebhook ? 'Enabling...' : 'Enable Auto-Deploy'}
                      </Button>
                    ) : (
                      <Badge variant="outline" className="px-3 py-1 border-[#00E599] text-[#00E599] bg-[#00E599]/10 shrink-0">Active</Badge>
                    )}
                  </div>
                  <div className="h-px w-full bg-[#FF5555]/20" />
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <h4 className="text-sm font-bold text-white">Delete Project</h4>
                      <p className="text-xs text-gray-400">Permanently remove this project and all its deployments.</p>
                    </div>
                    <Button onClick={deleteProject} variant="destructive" className="bg-[#FF5555] text-white hover:bg-[#FF3333] shrink-0 font-medium border-0">
                      Delete Project
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Other Tabs Placeholder */}
        {["Analytics", "Environment", "Domains"].includes(activeTab) && (
          <div className="flex flex-col items-center justify-center py-32 border border-[#1E1E1E] rounded-xl bg-[#0A0A0A] w-full">
            <Settings className="w-12 h-12 text-gray-600 mb-4" />
            <h3 className="text-xl font-bold text-gray-200 mb-2">{activeTab}</h3>
            <p className="text-sm text-gray-500 max-w-md text-center">
              This section is currently under development. Configuration options and metrics will be available here soon.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
