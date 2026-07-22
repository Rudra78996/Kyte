"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Ban, Boxes, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { useApiRequest } from "@/hooks/use-api";
import { ACTIVE_DEPLOYMENT_STATUSES, ADMIN_PAGE_SIZE, AdminDeployment, adminStatusVariant, formatAdminDate } from "@/lib/admin";
import { AdminDataCard, AdminEmpty, AdminPageHeader, AdminPageLoading } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

export default function AdminDeploymentsPage() {
  const apiRequest = useApiRequest();
  const [deployments, setDeployments] = useState<AdminDeployment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [cancelDeployment, setCancelDeployment] = useState<AdminDeployment | null>(null);

  const loadDeployments = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiRequest("GET", `/admin/deployments?take=${ADMIN_PAGE_SIZE}&skip=${page * ADMIN_PAGE_SIZE}`) as { deployments: AdminDeployment[]; total: number };
      setDeployments(result.deployments || []);
      setTotal(result.total || 0);
      setUpdatedAt(new Date());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load deployments");
    } finally {
      setLoading(false);
    }
  }, [apiRequest, page]);

  useEffect(() => {
    document.title = "Admin deployments | Kyte";
    const timer = setTimeout(() => void loadDeployments(), 0);
    return () => clearTimeout(timer);
  }, [loadDeployments]);

  async function confirmCancel() {
    if (!cancelDeployment) return;
    setCanceling(true);
    try {
      await apiRequest("POST", `/admin/deployments/${cancelDeployment.id}/cancel`);
      toast.success("Deployment canceled");
      setCancelDeployment(null);
      await loadDeployments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cancel deployment");
    } finally {
      setCanceling(false);
    }
  }

  if (loading && !updatedAt) return <AdminPageLoading />;

  return (
    <div className="app-page flex max-w-[1600px] flex-col gap-8 py-10">
      <AdminPageHeader title="Deployments" description="Review platform build history and cancel jobs that are still queued, building, or uploading." loading={loading} updatedAt={updatedAt} onRefresh={() => void loadDeployments()} />

      <AdminDataCard title="Build history" description="Deployment data is read on page load or when Refresh is pressed; this page does not poll." count={deployments.length} total={total} page={page} onPageChange={setPage}>
        <Table>
          <TableHeader><TableRow><TableHead>Deployment</TableHead><TableHead>Status</TableHead><TableHead>Source</TableHead><TableHead>Started</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {deployments.map((deployment) => {
              const active = ACTIVE_DEPLOYMENT_STATUSES.includes(deployment.status);
              return (
                <TableRow key={deployment.id}>
                  <TableCell className="min-w-64 whitespace-normal py-4"><p className="font-medium">{deployment.project.name}</p><p className="mt-1 text-xs text-muted-foreground">{deployment.project.user.email}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{deployment.commitSha.slice(0, 7)}</p></TableCell>
                  <TableCell><Badge variant={adminStatusVariant(deployment.status)}>{deployment.status}</Badge></TableCell>
                  <TableCell><p>{deployment.triggerSource}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><GitBranch className="size-3" />{deployment.branch}</p></TableCell>
                  <TableCell>{formatAdminDate(deployment.deployedAt)}</TableCell>
                  <TableCell><div className="flex justify-end gap-2"><Button size="sm" variant="ghost" render={<Link href={`/projects/${deployment.project.id}`} />}>Inspect</Button>{active && <Button size="sm" variant="destructive" onClick={() => setCancelDeployment(deployment)}><Ban data-icon="inline-start" />Cancel</Button>}</div></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {!deployments.length && <AdminEmpty icon={Boxes} title="No deployments found" description="Deployment history will appear here." />}
      </AdminDataCard>

      <AlertDialog open={!!cancelDeployment} onOpenChange={(open) => !open && !canceling && setCancelDeployment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Cancel this deployment?</AlertDialogTitle><AlertDialogDescription>The active build for {cancelDeployment?.project.name} will be marked canceled.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={canceling}>Keep running</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={canceling} onClick={() => void confirmCancel()}>Cancel deployment</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
