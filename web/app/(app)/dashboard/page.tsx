"use client";

import { useEffect, useState } from 'react';
import { useApiRequest } from '@/hooks/use-api';
import Link from 'next/link';
import { Search, ChevronDown, LayoutGrid, LayoutList, Plus, Activity, MoreHorizontal, GitBranch, ArrowRight } from 'lucide-react';
import { FaGithub } from 'react-icons/fa';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function Dashboard() {
  const apiRequest = useApiRequest();
  const [projects, setProjects] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [newProjectRepo, setNewProjectRepo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await apiRequest('GET', '/projects');
      setProjects(data.projects || []);
    } catch (err) {}
  };

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiRequest('POST', '/projects', {
        name: newProjectRepo.split('/').pop() || 'My Project',
        repoUrl: newProjectRepo,
      });
      setNewProjectRepo('');
      setOpen(false);
      loadProjects();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      {/* Actions bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="relative w-full max-w-[400px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            className="w-full bg-muted/50 border border-border rounded-md py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-all"
            placeholder="Search Projects"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center bg-muted/50 border border-border rounded-md p-1 h-[38px]">
            <button className="p-1.5 text-muted-foreground hover:text-foreground rounded-sm transition-colors">
              <LayoutList className="w-4 h-4" />
            </button>
            <button className="p-1.5 text-foreground bg-accent rounded-sm shadow-sm">
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger>
              <div className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-[38px] px-3.5 rounded-md text-sm font-medium transition-colors cursor-pointer">
                Add New <ChevronDown className="w-4 h-4 opacity-50" />
              </div>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Plus className="size-4" />
                  Import a Repository
                </DialogTitle>
                <DialogDescription>
                  Paste a public GitHub URL to import and deploy.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={createProject} className="flex flex-col gap-4 mt-2">
                <div className="relative flex-1">
                  <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <input
                    type="url"
                    placeholder="https://github.com/user/repo"
                    required
                    value={newProjectRepo}
                    onChange={e => setNewProjectRepo(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-md py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring transition-all"
                  />
                </div>
                <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-[38px] px-3.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50">
                  {loading ? 'Importing…' : 'Deploy'}
                  {!loading && <ArrowRight className="size-4" />}
                </button>
                {error && <p className="text-destructive text-sm mt-1">{error}</p>}
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Projects List */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Projects</h3>
        <div className="flex flex-col border border-border rounded-xl bg-muted/50 shadow-sm overflow-hidden">
          {projects.length > 0 ? projects.map((p, idx) => (
            <div key={p.id} className={`flex flex-col sm:flex-row sm:items-center p-5 hover:bg-accent/50 transition-colors cursor-pointer ${idx !== projects.length - 1 ? 'border-b border-border' : ''}`}>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_1.2fr] gap-4 sm:gap-6">
                
                {/* Project info */}
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-[42px] h-[42px] bg-background border border-border rounded-full flex items-center justify-center shrink-0 shadow-inner">
                    <span className="font-semibold text-lg text-foreground">
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0 justify-center">
                    <Link href={`/projects/${p.id}`} className="text-[15px] font-semibold text-foreground hover:underline truncate">
                      {p.name}
                    </Link>
                    <span className="text-[13px] text-muted-foreground truncate mt-0.5">{p.subdomain}.localhost</span>
                  </div>
                </div>
                
                {/* Commit info */}
                <div className="flex flex-col justify-center min-w-0">
                  <span className="text-sm text-foreground truncate">Initial project setup</span>
                  <span className="text-[13px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    Just now <GitBranch className="w-3.5 h-3.5 ml-0.5" /> main
                  </span>
                </div>
              </div>
              
              {/* Right actions */}
              <div className="flex items-center gap-5 mt-4 sm:mt-0 sm:pl-6 sm:ml-auto">
                <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground bg-muted/50 border border-border px-2.5 py-1 rounded-full shadow-sm">
                  <FaGithub className="w-[14px] h-[14px]" />
                  <span className="truncate max-w-[150px]">{p.repoUrl.replace('https://github.com/', '')}</span>
                </div>
                <div className="w-[26px] h-[26px] rounded-full border border-border bg-background flex items-center justify-center shrink-0">
                  <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <button className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-accent">
                  <MoreHorizontal className="w-[18px] h-[18px]" />
                </button>
              </div>
            </div>
          )) : (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-muted border border-border flex items-center justify-center mb-4">
                <Plus className="w-5 h-5 text-muted-foreground" />
              </div>
              <h3 className="text-foreground font-medium text-[15px] mb-1">No projects yet</h3>
              <p className="text-[13px] text-muted-foreground max-w-[300px]">
                Get started by importing a repository. Your projects will appear here once created.
              </p>
              <button onClick={() => setOpen(true)} className="mt-6 flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 rounded-md text-[13px] font-medium transition-colors">
                Add New Project
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
