import { Suspense } from 'react';
import { GithubCallbackClient } from './github-callback-client';

export default function GithubCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background px-6">
          <p className="text-sm text-muted-foreground">
            Connecting your GitHub account…
          </p>
        </main>
      }
    >
      <GithubCallbackClient />
    </Suspense>
  );
}
