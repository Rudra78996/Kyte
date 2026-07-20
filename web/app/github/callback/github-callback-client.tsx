'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { request } from '@/lib/api';

export function GithubCallbackClient() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const started = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || started.current) {
      return;
    }

    started.current = true;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (!code || !state) {
      router.replace('/settings?github=error');
      return;
    }

    void (async () => {
      try {
        const token = await getToken();
        if (!token) {
          throw new Error('No active Clerk session');
        }
        await request('POST', '/auth/github/callback', { code, state }, token);
        router.replace('/settings?github=connected');
      } catch {
        router.replace('/settings?github=error');
      }
    })();
  }, [getToken, isLoaded, isSignedIn, router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <p className="text-sm text-muted-foreground">
        Connecting your GitHub account…
      </p>
    </main>
  );
}
