"use client";

import { useEffect, useState, Suspense } from 'react';
import { useApiRequest } from '@/hooks/use-api';
import { useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

function SettingsContent() {
  const apiRequest = useApiRequest();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await apiRequest('GET', '/auth/me');
      setUser(data);
    } catch (err: any) { console.error(err); }
    finally { setLoading(false); }
  };

  const connectGithub = async () => {
    try {
      const res = await apiRequest('GET', '/auth/github/connect');
      if (res.url) window.location.href = res.url;
    } catch (err: any) {
      alert('Failed to initiate GitHub connection: ' + err.message);
    }
  };

  if (loading) return <div className="py-24 text-center text-muted-foreground animate-pulse">Loading…</div>;

  const githubStatus = searchParams?.get('github');

  return (
    <div className="max-w-2xl w-full flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and integrations.</p>
      </div>

      {githubStatus === 'connected' && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400">
          ✓ Successfully connected to GitHub! You can now use Auto-Deploy.
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
        <CardContent className="space-y-0 p-0">
          <div className="flex justify-between items-center px-6 py-4">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{user?.email}</span>
          </div>
          <Separator />
          <div className="flex justify-between items-center px-6 py-4">
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
                  <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50">
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Not Connected</Badge>
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
