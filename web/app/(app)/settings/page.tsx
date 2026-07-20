"use client";

import { useEffect, useState, Suspense, useCallback } from 'react';
import { useApiRequest } from '@/hooks/use-api';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { GitBranch, Layers3, Mail, UserRound } from 'lucide-react';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  email: string;
  githubConnected: boolean;
  githubUsername?: string;
}

interface ProjectLimit {
  limit: number;
  used: number;
  remaining: number;
  canCreate: boolean;
}

function SettingsContent() {
  const apiRequest = useApiRequest();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [projectLimit, setProjectLimit] = useState<ProjectLimit | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const [profile, limit] = await Promise.all([
        apiRequest('GET', '/auth/me'),
        apiRequest('GET', '/projects/limits'),
      ]);
      setUser(profile);
      setProjectLimit(limit);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  useEffect(() => {
    const timer = setTimeout(() => { void loadProfile(); }, 0);
    return () => clearTimeout(timer);
  }, [loadProfile]);

  const connectGithub = async () => {
    try {
      const res = await apiRequest('GET', '/auth/github/connect');
      if (res.url) window.location.href = res.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not connect GitHub');
    }
  };

  const disconnectGithub = async () => {
    if (!window.confirm('Disconnect GitHub and disable automatic deployment webhooks?')) return;
    setDisconnecting(true);
    try {
      const result = await apiRequest('DELETE', '/auth/github/disconnect');
      await loadProfile();
      if (result.cleanupWarnings) {
        toast.warning('GitHub disconnected. Some remote webhooks may need manual removal.');
      } else {
        toast.success('GitHub disconnected');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not disconnect GitHub');
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="app-page flex max-w-4xl flex-col gap-6">
        <div className="flex flex-col gap-3 border-b border-border pb-8">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-52 w-full rounded-lg" />
        <Skeleton className="h-44 w-full rounded-lg" />
      </div>
    );
  }

  const githubStatus = searchParams?.get('github');

  return (
    <div className="app-page flex max-w-4xl flex-col gap-6 pb-12">
      <header className="border-b border-border pb-8">
        <p className="section-label">Configuration</p>
        <h1 className="page-heading mt-2">Settings</h1>
        <p className="page-subtitle">Manage your account, usage, and connected services.</p>
      </header>

      <Card id="usage">
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
              <Layers3 className="size-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">Project usage</CardTitle>
              <CardDescription className="mt-1">Your portfolio workspace includes four project slots.</CardDescription>
            </div>
          </div>
          <Badge variant="secondary">Portfolio</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="font-mono text-3xl font-medium tracking-tight">
                {projectLimit?.used ?? 0}
                <span className="text-base text-muted-foreground"> / {projectLimit?.limit ?? 4}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {projectLimit?.remaining
                  ? `${projectLimit.remaining} ${projectLimit.remaining === 1 ? 'slot' : 'slots'} available`
                  : 'All project slots are in use'}
              </p>
            </div>
            <p className="text-right text-xs text-muted-foreground">Shared across your organizations</p>
          </div>
          <div
            role="progressbar"
            aria-label="Project allowance used"
            aria-valuemin={0}
            aria-valuemax={projectLimit?.limit ?? 4}
            aria-valuenow={projectLimit?.used ?? 0}
            className="h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${Math.min(100, ((projectLimit?.used ?? 0) / (projectLimit?.limit ?? 4)) * 100)}%` }}
            />
          </div>
        </CardContent>
        <Separator />
        <CardFooter className="flex-col items-start justify-between gap-3 pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">Delete an unused project to free a slot.</p>
          <Button variant="outline" size="sm" render={<Link href="/dashboard" />}>Manage projects</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Your identity in this Kyte workspace.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Mail className="size-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Used for your account and notifications.</p>
              </div>
            </div>
            <span className="break-all text-sm sm:text-right">{user?.email}</span>
          </div>
          <Separator />
          <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <UserRound className="size-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">User ID</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Your internal account identifier.</p>
              </div>
            </div>
            <span className="break-all font-mono text-xs text-muted-foreground sm:text-right">{user?.id}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
              <GitBranch className="size-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">GitHub</CardTitle>
              <CardDescription className="mt-1">
                Import repositories and create automatic deployments.
              </CardDescription>
            </div>
          </div>
          <Badge variant={user?.githubConnected ? "default" : "secondary"}>
            {user?.githubConnected ? 'Connected' : 'Not connected'}
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {user?.githubConnected
              ? `Connected as @${user.githubUsername}. Webhooks can be managed from each project’s settings.`
              : 'Connect GitHub to import private repositories and deploy when you push to your production branch.'}
          </p>
          {githubStatus === 'connected' && (
            <p className="mt-3 text-xs text-muted-foreground">GitHub was connected successfully.</p>
          )}
          {githubStatus === 'error' && (
            <p className="mt-3 text-xs text-destructive">GitHub could not be connected. Try again.</p>
          )}
        </CardContent>
        {!user?.githubConnected ? (
          <>
            <Separator />
            <CardFooter className="justify-end pt-6">
              <Button onClick={connectGithub} size="sm">Connect GitHub</Button>
            </CardFooter>
          </>
        ) : (
          <>
            <Separator />
            <CardFooter className="justify-end pt-6">
              <Button variant="outline" onClick={disconnectGithub} disabled={disconnecting} size="sm">
                {disconnecting ? 'Disconnecting…' : 'Disconnect GitHub'}
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}

export default function Settings() {
  useEffect(() => { document.title = "Settings | Kyte"; }, []);
  return (
    <Suspense fallback={<div className="app-page max-w-4xl"><Skeleton className="h-52 w-full rounded-lg" /></div>}>
      <SettingsContent />
    </Suspense>
  );
}
