"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Globe2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useApiRequest } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DnsRecord = { type: string; name: string; value: string };
type CustomDomain = {
  id: string;
  domainName: string;
  status: "pending" | "verified";
  verifiedAt: string | null;
  dnsRecords: { routing: DnsRecord; verification: DnsRecord };
};

export function DomainManager({ projectId }: { projectId: string }) {
  const apiRequest = useApiRequest();
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [hostname, setHostname] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeDomain, setActiveDomain] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState("");

  const loadDomains = useCallback(async () => {
    try {
      const data = await apiRequest("GET", `/projects/${projectId}/domains`);
      setDomains(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load custom domains");
    } finally {
      setIsLoading(false);
    }
  }, [apiRequest, projectId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadDomains(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDomains]);

  const copyValue = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied((current) => current === label ? "" : current), 1600);
  };

  const addDomain = async () => {
    if (!hostname.trim()) return;
    setIsSubmitting(true);
    setError("");
    try {
      await apiRequest("POST", `/projects/${projectId}/domains`, { domainName: hostname });
      setHostname("");
      setIsAdding(false);
      setNotice("Domain added. Add both DNS records, then verify the connection.");
      await loadDomains();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not add domain");
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyDomain = async (domainName: string) => {
    setActiveDomain(domainName);
    setError("");
    try {
      const result = await apiRequest("POST", `/projects/${projectId}/domains/${encodeURIComponent(domainName)}/verify`);
      setNotice(result.message || (result.status === "verified" ? "Domain verified." : "DNS records are not visible yet."));
      await loadDomains();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not verify domain");
    } finally {
      setActiveDomain(null);
    }
  };

  const removeDomain = async (domainName: string) => {
    setActiveDomain(domainName);
    setError("");
    try {
      await apiRequest("DELETE", `/projects/${projectId}/domains/${encodeURIComponent(domainName)}`);
      setNotice(`${domainName} was removed.`);
      await loadDomains();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not remove domain");
    } finally {
      setActiveDomain(null);
    }
  };

  return <>
    <Card className="overflow-hidden border-border bg-card shadow-none">
      <CardHeader className="flex-row items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <CardTitle className="text-sm font-medium">Custom domains</CardTitle>
          <CardDescription className="mt-1 text-xs leading-5">Connect a hostname to this project&apos;s active production deployment.</CardDescription>
        </div>
        <Button size="sm" onClick={() => { setError(""); setIsAdding(true); }}><Plus data-icon="inline-start" />Add domain</Button>
      </CardHeader>
      <CardContent className="p-0">
        {notice && <p className="border-b border-emerald-500/20 bg-emerald-500/5 px-5 py-3 text-xs text-emerald-400">{notice}</p>}
        {error && <p className="border-b border-destructive/30 bg-destructive/5 px-5 py-3 text-xs text-destructive">{error}</p>}
        {isLoading ? <p className="px-5 py-6 text-sm text-muted-foreground">Loading domains...</p> : domains.length === 0 ? <div className="px-5 py-8 text-center"><Globe2 className="mx-auto size-5 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No custom domains</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">Add a domain to receive the DNS records needed to route traffic and verify ownership.</p></div> : <div className="divide-y divide-border">{domains.map((domain) => <div key={domain.id} className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground"><Globe2 className="size-4" /></div><div className="min-w-0"><p className="truncate font-mono text-sm text-foreground">{domain.domainName}</p><p className="mt-1 text-xs text-muted-foreground">{domain.status === "verified" ? "Connected to the active production deployment" : "Waiting for DNS verification"}</p></div></div>
            <div className="flex shrink-0 items-center gap-2"><Badge variant="outline" className={domain.status === "verified" ? "gap-1.5 border-emerald-500/30 bg-emerald-500/5 text-emerald-400" : "gap-1.5 border-amber-500/30 bg-amber-500/5 text-amber-300"}><span className={domain.status === "verified" ? "size-1.5 rounded-full bg-emerald-400" : "size-1.5 rounded-full bg-amber-400"} />{domain.status === "verified" ? "Verified" : "Pending"}</Badge>{domain.status === "verified" && <Button variant="ghost" size="icon-sm" title={`Visit ${domain.domainName}`} render={<a href={`https://${domain.domainName}`} target="_blank" rel="noreferrer" />}><ExternalLink /></Button>}<Button variant="ghost" size="icon-sm" title={`Remove ${domain.domainName}`} disabled={activeDomain === domain.domainName} onClick={() => void removeDomain(domain.domainName)} className="text-muted-foreground hover:text-destructive"><Trash2 /></Button></div>
          </div>
          {domain.status !== "verified" && <div className="mt-5 overflow-hidden rounded-md border border-border"><div className="border-b border-border bg-muted/30 px-4 py-3"><p className="text-xs font-medium">Add these DNS records</p><p className="mt-1 text-xs text-muted-foreground">DNS changes can take a few minutes to become visible.</p></div><DnsRecordRow record={domain.dnsRecords.routing} label={`routing-${domain.id}`} copied={copied} onCopy={copyValue} /><DnsRecordRow record={domain.dnsRecords.verification} label={`verification-${domain.id}`} copied={copied} onCopy={copyValue} /><div className="flex flex-col justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center"><p className="text-xs leading-5 text-muted-foreground">For an apex domain, use your provider&apos;s ALIAS or ANAME option when CNAME is unavailable.</p><Button size="sm" variant="outline" disabled={activeDomain === domain.domainName} onClick={() => void verifyDomain(domain.domainName)}>{activeDomain === domain.domainName ? <RefreshCw data-icon="inline-start" className="animate-spin" /> : <RefreshCw data-icon="inline-start" />}Verify DNS</Button></div></div>}
        </div>)}</div>}
      </CardContent>
    </Card>

    <Dialog open={isAdding} onOpenChange={setIsAdding}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add custom domain</DialogTitle><DialogDescription>Enter the hostname you want people to use. You&apos;ll add DNS records before it goes live.</DialogDescription></DialogHeader>
        <div className="grid gap-2"><Label htmlFor="custom-domain">Hostname</Label><Input id="custom-domain" value={hostname} onChange={(event) => setHostname(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void addDomain(); }} placeholder="www.example.com" autoComplete="off" /></div>
        <DialogFooter showCloseButton><Button onClick={() => void addDomain()} disabled={isSubmitting || !hostname.trim()}>{isSubmitting ? "Adding..." : "Add domain"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

function DnsRecordRow({ record, label, copied, onCopy }: { record: DnsRecord; label: string; copied: string; onCopy: (value: string, label: string) => Promise<void> }) {
  return <div className="grid gap-3 border-b border-border px-4 py-3 sm:grid-cols-[60px_minmax(0,1fr)_minmax(0,1.25fr)_32px] sm:items-center"><span className="font-mono text-[11px] text-muted-foreground">{record.type}</span><code className="break-all font-mono text-xs text-foreground">{record.name}</code><code className="break-all font-mono text-xs text-foreground">{record.value}</code><Button variant="ghost" size="icon-sm" title={`Copy ${record.type} value`} onClick={() => void onCopy(record.value, label)}>{copied === label ? <Check className="text-emerald-400" /> : <Copy />}</Button></div>;
}
