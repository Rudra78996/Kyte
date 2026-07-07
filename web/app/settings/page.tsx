"use client";

import { useEffect, useState, Suspense } from 'react';
import { request, getToken, logout } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await request('GET', '/auth/me');
      setUser(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const connectGithub = async () => {
    try {
      const res = await request('GET', '/auth/github/connect');
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      alert('Failed to initiate GitHub connection: ' + err.message);
    }
  };

  if (loading) return <div className="py-24 text-center text-slate-500 animate-pulse">Loading settings...</div>;

  const githubStatus = searchParams?.get('github');
  
  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <Link href="/dashboard" className="text-sm text-slate-400 hover:text-slate-300 transition-colors mb-2 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-slate-100 tracking-tight block">Settings</h1>
          <p className="text-slate-400">Manage your account and integrations.</p>
        </div>
        <Button onClick={logout} variant="outline" className="border-slate-800 text-slate-300 hover:bg-slate-800">
          Sign Out
        </Button>
      </div>

      {githubStatus === 'connected' && (
        <div className="mb-6 p-4 bg-emerald-950/30 border border-emerald-900/50 rounded-lg text-emerald-400">
          Successfully connected to GitHub! You can now use Auto-Deploy.
        </div>
      )}
      
      {githubStatus === 'error' && (
        <div className="mb-6 p-4 bg-red-950/30 border border-red-900/50 rounded-lg text-red-400">
          Failed to connect to GitHub. Please try again.
        </div>
      )}

      <Card className="bg-slate-900 border-slate-800 mb-6">
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>Your personal information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-slate-300">
          <div className="flex justify-between border-b border-slate-800 pb-4">
            <span className="text-slate-500">Email</span>
            <span>{user?.email}</span>
          </div>
          <div className="flex justify-between pb-2">
            <span className="text-slate-500">User ID</span>
            <span className="font-mono text-xs">{user?.id}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Connect third-party services to Deployly.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border border-slate-800 rounded-lg bg-slate-950/50">
            <div>
              <div className="font-medium text-slate-200 flex items-center gap-2">
                GitHub 
                {user?.githubConnected ? (
                  <Badge variant="outline" className="bg-emerald-950/30 text-emerald-400 border-emerald-900/50">Connected</Badge>
                ) : (
                  <Badge variant="outline" className="bg-slate-800 text-slate-400 border-slate-700">Not Connected</Badge>
                )}
              </div>
              <div className="text-sm text-slate-400 mt-1">
                {user?.githubConnected 
                  ? `Connected as @${user.githubUsername}` 
                  : 'Connect your account to enable automated webhook deployments.'}
              </div>
            </div>
            {!user?.githubConnected && (
              <Button onClick={connectGithub} className="bg-[#24292F] hover:bg-[#24292F]/90 text-white">
                Connect GitHub
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Settings() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-slate-500 animate-pulse">Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
