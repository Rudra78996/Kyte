"use client";

import { useEffect, useState } from 'react';
import { request, getToken, logout } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MagicCard } from '@/components/ui/magic-card';
import { NumberTicker } from '@/components/ui/number-ticker';
import { Globe, PlusCircle, ArrowRight, GitBranch } from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [newProjectRepo, setNewProjectRepo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = getToken();
    if (!t) { router.push('/login'); return; }
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await request('GET', '/projects');
      setProjects(data.projects || []);
    } catch (err: any) { setError(err.message); }
  };

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await request('POST', '/projects', {
        name: newProjectRepo.split('/').pop() || 'My Project',
        repoUrl: newProjectRepo,
      });
      setNewProjectRepo('');
      loadProjects();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Deploy and manage your projects from one place.
        </p>
      </div>

      {/* Stats row */}
      {projects.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Projects</p>
            <p className="text-3xl font-bold">
              <NumberTicker value={projects.length} />
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Active</p>
            <p className="text-3xl font-bold">
              <NumberTicker value={projects.length} />
            </p>
          </Card>
          <Card className="hidden sm:block p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Deployments</p>
            <p className="text-3xl font-bold text-muted-foreground">—</p>
          </Card>
        </div>
      )}

      {/* Deploy card with BorderBeam */}
      <div className="relative rounded-xl overflow-hidden">
        <Card className="border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <PlusCircle className="size-4" />
              Import a Repository
            </CardTitle>
            <CardDescription>
              Paste a public GitHub URL — Kyte will build and deploy it automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createProject} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="url"
                  placeholder="https://github.com/user/repo"
                  required
                  value={newProjectRepo}
                  onChange={e => setNewProjectRepo(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button type="submit" disabled={loading} className="shrink-0">
                {loading ? 'Importing…' : 'Deploy'}
                {!loading && <ArrowRight className="ml-1 size-4" />}
              </Button>
            </form>
            {error && <p className="text-destructive text-sm mt-2">{error}</p>}
          </CardContent>
        </Card>
      </div>

      {/* Projects grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Your Projects
          </h2>
          {projects.length > 0 && (
            <Badge variant="secondary" className="rounded-full text-xs">
              {projects.length} {projects.length === 1 ? 'project' : 'projects'}
            </Badge>
          )}
        </div>

        {projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(p => (
              <Link key={p.id} href={`/projects/${p.id}`}>
                <MagicCard
                  className="rounded-xl cursor-pointer h-full"
                  gradientColor="hsl(0, 0%, 93%)"
                  gradientOpacity={0.6}
                >
                  <Card className="border-0 shadow-none bg-transparent h-full">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Globe className="size-4 text-muted-foreground" />
                          </div>
                          <CardTitle className="text-sm font-semibold truncate">{p.name}</CardTitle>
                        </div>
                        <Badge variant="secondary" className="shrink-0 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50">
                          Active
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-xs text-muted-foreground truncate">{p.repoUrl}</p>
                      <p className="text-xs font-mono text-muted-foreground/80 truncate">
                        {p.subdomain}.localhost
                      </p>
                    </CardContent>
                  </Card>
                </MagicCard>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border border-dashed rounded-xl text-muted-foreground">
            <Globe className="size-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No projects yet</p>
            <p className="text-xs mt-1">Import a repository above to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
