"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleAlert, Search, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useApiRequest } from "@/hooks/use-api";
import { ADMIN_PAGE_SIZE, AdminUser, formatAdminDate } from "@/lib/admin";
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

export default function AdminUsersPage() {
  const apiRequest = useApiRequest();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [defaultLimit, setDefaultLimit] = useState(4);
  const [loading, setLoading] = useState(true);
  const [actionRunning, setActionRunning] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ take: String(ADMIN_PAGE_SIZE), skip: String(page * ADMIN_PAGE_SIZE) });
      if (search) params.set("search", search);
      const [result, settings] = await Promise.all([
        apiRequest("GET", `/admin/users?${params.toString()}`) as Promise<{ users: AdminUser[]; total: number }>,
        apiRequest("GET", "/admin/settings") as Promise<{ defaultProjectLimit: number }>,
      ]);
      setUsers(result.users || []);
      setTotal(result.total || 0);
      setDefaultLimit(settings.defaultProjectLimit);
      setUpdatedAt(new Date());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load users");
    } finally {
      setLoading(false);
    }
  }, [apiRequest, page, search]);

  useEffect(() => {
    document.title = "Admin users | Kyte";
    const timer = setTimeout(() => void loadUsers(), 0);
    return () => clearTimeout(timer);
  }, [loadUsers]);

  async function updateUser(user: AdminUser, patch: { role?: "USER" | "ADMIN"; projectLimitOverride?: number | null }) {
    setActionRunning(true);
    try {
      await apiRequest("PATCH", `/admin/users/${user.id}`, patch);
      toast.success(`Updated ${user.email}`);
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update user");
    } finally {
      setActionRunning(false);
    }
  }

  async function confirmDelete() {
    if (!deleteUser) return;
    setActionRunning(true);
    try {
      await apiRequest("DELETE", `/admin/users/${deleteUser.id}`);
      toast.success("User deleted");
      setDeleteUser(null);
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete user");
    } finally {
      setActionRunning(false);
    }
  }

  if (loading && !updatedAt) return <AdminPageLoading />;

  return (
    <div className="app-page flex max-w-[1600px] flex-col gap-8 py-10">
      <AdminPageHeader title="User administration" description="Manage account roles, GitHub connection state, project allowances, and account deletion." loading={loading} updatedAt={updatedAt} onRefresh={() => void loadUsers()} />

      <form
        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(0);
          setSearch(searchDraft.trim());
        }}
      >
        <Search className="hidden text-muted-foreground sm:block" />
        <Input aria-label="Search users" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search email or username" />
        <Button type="submit" variant="outline">Search users</Button>
        {search && <Button type="button" variant="ghost" onClick={() => { setSearchDraft(""); setSearch(""); setPage(0); }}>Clear</Button>}
      </form>

      <AdminDataCard title="Accounts" description="Role and allowance changes apply immediately." count={users.length} total={total} page={page} onPageChange={setPage}>
        <Table>
          <TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Access</TableHead><TableHead>Usage</TableHead><TableHead>Project allowance</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="min-w-64 whitespace-normal py-4"><p className="font-medium">{user.username || "Unnamed user"}</p><p className="mt-1 text-xs text-muted-foreground">{user.email}</p><p className="mt-1 text-xs text-muted-foreground">Joined {formatAdminDate(user.createdAt)}</p></TableCell>
                <TableCell><div className="flex flex-col items-start gap-2"><Badge variant={user.role === "ADMIN" ? "secondary" : "outline"}>{user.role}</Badge><span className="text-xs text-muted-foreground">{user._count.githubConnections ? "GitHub connected" : "No GitHub connection"}</span></div></TableCell>
                <TableCell>{user._count.projects} projects</TableCell>
                <TableCell><UserLimit key={`${user.id}-${user.projectLimitOverride ?? "default"}`} user={user} defaultLimit={defaultLimit} disabled={actionRunning} onSave={(limit) => void updateUser(user, { projectLimitOverride: limit })} /></TableCell>
                <TableCell><div className="flex justify-end gap-2"><Button size="sm" variant="outline" disabled={actionRunning} onClick={() => void updateUser(user, { role: user.role === "ADMIN" ? "USER" : "ADMIN" })}><ShieldCheck data-icon="inline-start" />{user.role === "ADMIN" ? "Demote" : "Promote"}</Button><Button size="icon-sm" variant="destructive" title={`Delete ${user.email}`} disabled={actionRunning} onClick={() => setDeleteUser(user)}><Trash2 /></Button></div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!users.length && <AdminEmpty icon={Users} title="No users found" description="Change or clear the search to see accounts." />}
      </AdminDataCard>

      <AlertDialog open={!!deleteUser} onOpenChange={(open) => !open && !actionRunning && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogMedia><CircleAlert /></AlertDialogMedia><AlertDialogTitle>Delete this account?</AlertDialogTitle><AlertDialogDescription>{deleteUser?.email} and all projects owned by the account will be permanently removed.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={actionRunning}>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={actionRunning} onClick={() => void confirmDelete()}>Delete account</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserLimit({ defaultLimit, disabled, onSave, user }: { defaultLimit: number; disabled: boolean; onSave: (limit: number | null) => void; user: AdminUser }) {
  const [value, setValue] = useState(user.projectLimitOverride == null ? "" : String(user.projectLimitOverride));
  return (
    <div className="flex min-w-52 flex-col gap-2">
      <div className="flex gap-2"><Input aria-label={`Project limit for ${user.email}`} className="w-20" type="number" min={0} max={100} value={value} placeholder={String(defaultLimit)} onChange={(event) => setValue(event.target.value)} /><Button size="sm" variant="outline" disabled={disabled || value === ""} onClick={() => onSave(Number(value))}>Save</Button></div>
      <button type="button" className="w-fit text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50" disabled={disabled || user.projectLimitOverride == null} onClick={() => onSave(null)}>Use platform default ({defaultLimit})</button>
    </div>
  );
}
