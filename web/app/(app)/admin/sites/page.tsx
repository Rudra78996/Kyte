"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CircleAlert, ExternalLink, Globe2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useApiRequest } from "@/hooks/use-api";
import { siteUrl } from "@/lib/site-url";
import { ADMIN_PAGE_SIZE, AdminProject, adminStatusVariant } from "@/lib/admin";
import { AdminDataCard, AdminEmpty, AdminPageHeader, AdminPageLoading } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AdminSitesPage() {
  const apiRequest = useApiRequest();
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [deleteProject, setDeleteProject] = useState<AdminProject | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ take: String(ADMIN_PAGE_SIZE), skip: String(page * ADMIN_PAGE_SIZE) });
      if (search) params.set("search", search);
      const result = await apiRequest("GET", `/admin/projects?${params.toString()}`) as { projects: AdminProject[]; total: number };
      setProjects(result.projects || []);
      setTotal(result.total || 0);
      setUpdatedAt(new Date());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load hosted sites");
    } finally {
      setLoading(false);
    }
  }, [apiRequest, page, search]);

  useEffect(() => {
    document.title = "Admin hosted sites | Kyte";
    const timer = setTimeout(() => void loadProjects(), 0);
    return () => clearTimeout(timer);
  }, [loadProjects]);

  async function confirmDelete() {
    if (!deleteProject) return;
    setDeleting(true);
    try {
      await apiRequest("DELETE", `/admin/projects/${deleteProject.id}`);
      toast.success("Hosted site deleted");
      setDeleteProject(null);
      await loadProjects();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete hosted site");
    } finally {
      setDeleting(false);
    }
  }

  if (loading && !updatedAt) return <AdminPageLoading />;

  return (
    <div className="app-page flex max-w-[1600px] flex-col gap-8 py-10">
      <AdminPageHeader title="Hosted sites" description="Inspect project ownership, repository source, deployment state, domains, and recorded traffic." loading={loading} updatedAt={updatedAt} onRefresh={() => void loadProjects()} />

      <form className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center" onSubmit={(event) => { event.preventDefault(); setPage(0); setSearch(searchDraft.trim()); }}>
        <Search className="hidden text-muted-foreground sm:block" />
        <Input aria-label="Search hosted sites" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search site, repository, subdomain, or owner email" />
        <Button type="submit" variant="outline">Search sites</Button>
        {search && <Button type="button" variant="ghost" onClick={() => { setSearchDraft(""); setSearch(""); setPage(0); }}>Clear</Button>}
      </form>

      <AdminDataCard title="Projects" description="Deleting a project removes its deployments, logs, environment variables, domains, and analytics records." count={projects.length} total={total} page={page} onPageChange={setPage}>
        <Table>
          <TableHeader><TableRow><TableHead>Website</TableHead><TableHead>Owner</TableHead><TableHead>Status</TableHead><TableHead>Platform activity</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id}>
                <TableCell className="min-w-72 whitespace-normal py-4"><p className="font-medium">{project.name}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{project.subdomain}</p><p className="mt-1 max-w-80 truncate text-xs text-muted-foreground">{project.repoUrl}</p></TableCell>
                <TableCell><p>{project.user.username || project.user.email}</p>{project.user.username && <p className="mt-1 text-xs text-muted-foreground">{project.user.email}</p>}</TableCell>
                <TableCell><Badge variant={adminStatusVariant(project.activeDeploy?.status || "NONE")}>{project.activeDeploy?.status || "No deployment"}</Badge></TableCell>
                <TableCell><p>{project._count.deployments} deployments</p><p className="mt-1 text-xs text-muted-foreground">{project._count.customDomains} domains · {project._count.requestLogs ?? 0} tracked views</p></TableCell>
                <TableCell><div className="flex justify-end gap-1"><Button size="icon-sm" variant="ghost" title="Open project" render={<Link href={`/projects/${project.id}`} />}><ExternalLink /></Button><Button size="icon-sm" variant="ghost" title="Visit website" render={<a href={siteUrl(project.subdomain)} target="_blank" rel="noreferrer" />}><Globe2 /></Button><Button size="icon-sm" variant="destructive" title={`Delete ${project.name}`} onClick={() => setDeleteProject(project)}><Trash2 /></Button></div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!projects.length && <AdminEmpty icon={Globe2} title="No hosted sites found" description="Change or clear the search to see projects." />}
      </AdminDataCard>

      <AlertDialog open={!!deleteProject} onOpenChange={(open) => !open && !deleting && setDeleteProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogMedia><CircleAlert /></AlertDialogMedia><AlertDialogTitle>Delete this hosted site?</AlertDialogTitle><AlertDialogDescription>{deleteProject?.name} and all related deployment data will be permanently removed.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>Delete site</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
