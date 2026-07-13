"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApiRequest } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RequestError = Error & { status?: number; details?: { suggestedSlug?: string } };

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestedSlug, setSuggestedSlug] = useState("");
  const [checking, setChecking] = useState(true);
  const apiRequest = useApiRequest();

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest("GET", "/organizations");
        if (res.organizations && res.organizations.length > 0) {
          router.replace("/dashboard");
          return;
        }
      } catch {
        // Ignore errors — allow onboarding to show
      } finally {
        setChecking(false);
      }
    })();
  }, [apiRequest, router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuggestedSlug("");
    setLoading(true);
    try {
      await apiRequest("POST", "/organizations", { name, slug });
      window.location.href = "/dashboard";
    } catch (cause) {
      const requestError = cause as RequestError;
      console.error(cause);
      setError(requestError.message || "Could not create your workspace.");
      setSuggestedSlug(requestError.details?.suggestedSlug || "");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 sm:p-8">
        <div className="mb-8"><p className="text-xs font-medium text-muted-foreground">Kyte</p><h1 className="mt-2 text-xl font-medium tracking-tight">Create your workspace</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">A workspace keeps projects, deployments, and settings in one place.</p></div>
        <form onSubmit={handleCreate} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Organization Name</label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
              }}
              placeholder="Acme Corp"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Organization URL</label>
            <div className="flex items-center">
              <span className="rounded-l-md border border-r-0 border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
                kyte.com/
              </span>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="rounded-l-none"
                required
              />
            </div>
            <p className="text-xs leading-5 text-muted-foreground">Use lowercase letters, numbers, and hyphens.</p>
          </div>
          {error && <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive"><p>{error}</p>{suggestedSlug && <button type="button" onClick={() => { setSlug(suggestedSlug); setError(""); setSuggestedSlug(""); }} className="mt-2 text-xs font-medium text-destructive underline underline-offset-4 hover:opacity-80 block">Use {suggestedSlug}</button>}</div>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create Organization"}
          </Button>
        </form>
      </div>
    </main>
  );
}
