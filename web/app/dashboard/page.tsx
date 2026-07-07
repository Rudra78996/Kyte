"use client";

import { useEffect, useState } from 'react';
import { request, getToken, logout } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [newProjectRepo, setNewProjectRepo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.push('/login');
      return;
    }
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await request('GET', '/projects');
      setProjects(data.projects || []);
    } catch (err: any) {
      setError(err.message);
    }
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 tracking-tight">Dashboard</h1>
          <p className="text-slate-400">Manage your projects and deployments.</p>
        </div>
        <div className="flex gap-4">
          <Link href="/settings">
            <Button variant="outline" className="border-slate-800 text-slate-300 hover:bg-slate-800">
              Settings
            </Button>
          </Link>
          <Button onClick={logout} variant="outline" className="border-slate-800 text-slate-300 hover:bg-slate-800">
            Sign Out
          </Button>
        </div>
      </div>

      <Card className="mb-8 bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle>Deploy a new project</CardTitle>
          <CardDescription>Enter a public GitHub repository URL to trigger a new deployment.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createProject} className="flex gap-4">
            <Input 
              type="url" 
              placeholder="https://github.com/user/repo" 
              required 
              value={newProjectRepo}
              onChange={e => setNewProjectRepo(e.target.value)}
              className="bg-slate-950 border-slate-800 flex-1"
            />
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
              {loading ? 'Importing...' : 'Import & Deploy'}
            </Button>
          </form>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map(p => (
          <Link key={p.id} href={`/projects/${p.id}`}>
            <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-all cursor-pointer h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex justify-between items-start">
                  <span className="truncate">{p.name}</span>
                  <Badge variant="outline" className="bg-emerald-950/30 text-emerald-400 border-emerald-900/50 ml-2 whitespace-nowrap">
                    Active
                  </Badge>
                </CardTitle>
                <CardDescription className="truncate text-xs">{p.repoUrl}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-blue-400 truncate">
                  {p.subdomain}.localhost
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      
      {projects.length === 0 && !loading && (
        <div className="text-center py-12 border border-dashed border-slate-800 rounded-lg text-slate-500">
          No projects found. Create one above to get started!
        </div>
      )}
    </div>
  );
}
