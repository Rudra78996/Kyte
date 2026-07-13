"use client";

import { useEffect, useState, Suspense, useCallback } from 'react';
import { useApiRequest } from '@/hooks/use-api';
import { useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface UserProfile {
  id: string;
  email: string;
  githubConnected: boolean;
  githubUsername?: string;
}

function SettingsContent() {
  const apiRequest = useApiRequest();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      const data = await apiRequest('GET', '/auth/me');
      setUser(data);
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
      alert('Failed to initiate GitHub connection: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  if (loading) return <div className="py-24 text-center text-muted-foreground animate-pulse">Loading…</div>;

  const githubStatus = searchParams?.get('github');

  return (
    <div className="app-page max-w-3xl flex flex-col gap-6">
      <header className="border-b border-border pb-8">
        <p className="section-label">Workspace</p>
        <h1 className="page-heading mt-2">Settings</h1>
        <p className="page-subtitle">Manage your account and integrations.</p>
      </header>

      {githubStatus === 'connected' && (
        <div className="rounded-lg border border-border bg-muted px-4 py-4 text-sm text-muted-foreground">
          GitHub connected. You can now enable automatic deployments.
        </div>
      )}
      {githubStatus === 'error' && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          Failed to connect to GitHub. Please try again.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>Your personal information.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-6 py-4">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{user?.email}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between px-6 py-4">
            <span className="text-sm text-muted-foreground">User ID</span>
            <span className="font-mono text-xs text-muted-foreground">{user?.id}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Connect third-party services to Kyte.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <div className="text-sm font-medium flex items-center gap-2">
                GitHub
                {user?.githubConnected ? (
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] font-normal text-emerald-400">
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30">Not Connected</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {user?.githubConnected
                  ? `Connected as @${user.githubUsername}`
                  : 'Connect to enable automated webhook deployments.'}
              </p>
            </div>
            {!user?.githubConnected && (
              <Button onClick={connectGithub} size="sm">Connect GitHub</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Settings() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-muted-foreground animate-pulse">Loading…</div>}>
      <SettingsContent />
    </Suspense>
  );
}
