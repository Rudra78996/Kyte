"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, Ban, Boxes, CheckCircle2, Globe2, Users } from "lucide-react";
import { toast } from "sonner";
import { useApiRequest } from "@/hooks/use-api";
import { ACTIVE_DEPLOYMENT_STATUSES, AdminOverview, adminStatusVariant } from "@/lib/admin";
import { AdminEmpty, AdminMetricCard, AdminPageHeader, AdminPageLoading } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AdminOverviewPage() {
  const apiRequest = useApiRequest();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [cancelDeployment, setCancelDeployment] = useState<{ id: string; project: string } | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      setOverview(await apiRequest("GET", "/admin/overview"));
      setUpdatedAt(new Date());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load admin overview");
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  useEffect(() => {
    document.title = "Admin overview | Kyte";
    const timer = setTimeout(() => void loadOverview(), 0);
    return () => clearTimeout(timer);
  }, [loadOverview]);

  async function confirmCancel() {
    if (!cancelDeployment) return;
    try {
      await apiRequest("POST", `/admin/deployments/${cancelDeployment.id}/cancel`);
      toast.success("Deployment canceled");
      setCancelDeployment(null);
      await loadOverview();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cancel deployment");
    }
  }

  if (!overview && loading) return <AdminPageLoading />;

  return (
    <div className="app-page flex max-w-[1600px] flex-col gap-8 py-10">
      <AdminPageHeader title="Admin overview" description="Platform state, capacity, and the active build queue." loading={loading} updatedAt={updatedAt} onRefresh={() => void loadOverview()} />

      <Card className="shadow-none">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Deployment intake</CardTitle>
              <Badge variant={overview?.settings.deploymentsPaused ? "destructive" : "secondary"}>{overview?.settings.deploymentsPaused ? "Paused" : "Open"}</Badge>
            </div>
            <CardDescription className="mt-2">The default account allowance is {overview?.settings.defaultProjectLimit ?? 4} projects.</CardDescription>
          </div>
          <Button variant="outline" render={<Link href="/admin/settings" />}>Manage platform settings</Button>
        </CardHeader>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Platform summary">
        <AdminMetricCard icon={Users} label="Accounts" value={overview?.users ?? 0} detail="Registered users" />
        <AdminMetricCard icon={Globe2} label="Hosted sites" value={overview?.projects ?? 0} detail="Across all accounts" />
        <AdminMetricCard icon={Boxes} label="Deployments" value={overview?.deployments ?? 0} detail="Lifetime builds" />
        <AdminMetricCard icon={Activity} label="Active queue" value={overview?.activeDeployments ?? 0} detail="Queued or running" />
      </section>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Active build queue</CardTitle>
          <CardDescription>Only queued, building, and uploading deployments appear here.</CardDescription>
        </CardHeader>
        <CardContent>
          {overview?.activeDeploymentItems.length ? (
            <div className="flex flex-col gap-3">
              {overview.activeDeploymentItems.map((deployment) => (
                <div key={deployment.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-medium">{deployment.project.name}</p><Badge variant={adminStatusVariant(deployment.status)}>{deployment.status}</Badge></div>
                    <p className="mt-2 truncate text-xs text-muted-foreground">{deployment.project.user.email} · {deployment.commitSha.slice(0, 7)}</p>
                  </div>
                  {ACTIVE_DEPLOYMENT_STATUSES.includes(deployment.status) && (
                    <Button size="sm" variant="destructive" onClick={() => setCancelDeployment({ id: deployment.id, project: deployment.project.name })}><Ban data-icon="inline-start" />Cancel build</Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <AdminEmpty icon={CheckCircle2} title="Build queue is clear" description="No deployments are queued, building, or uploading." />
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!cancelDeployment} onOpenChange={(open) => !open && setCancelDeployment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Cancel this deployment?</AlertDialogTitle><AlertDialogDescription>The active build for {cancelDeployment?.project} will be marked canceled.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Keep running</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void confirmCancel()}>Cancel deployment</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
