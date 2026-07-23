"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@clerk/nextjs"
import { useApiRequest } from "@/hooks/use-api"
import { NavUser } from "@/components/nav-user"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarGroup,
  SidebarGroupLabel,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  PlusIcon,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  ChevronDown,
  LayoutDashboard,
  Rocket,
  X,
  Command,
  Building2,
  Search,
  AppWindow,
  Settings2,
  ShieldCheck,
  ChevronRight,
} from "lucide-react"

type RequestError = Error & { status?: number; details?: { suggestedSlug?: string } };

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const apiRequest = useApiRequest();

  interface SidebarOrg {
    id: string;
    name: string;
  }

  interface SidebarProject {
    id: string;
    name: string;
  }

  interface SidebarDeployment {
    id: string;
    status: string;
    commitSha?: string;
    project?: { name?: string };
  }

  interface ProjectLimit {
    limit: number;
    used: number;
    remaining: number;
    canCreate: boolean;
  }

  const [projects, setProjects] = React.useState<SidebarProject[]>([]);
  const [organizations, setOrganizations] = React.useState<SidebarOrg[]>([]);
  const [organizationsLoading, setOrganizationsLoading] = React.useState(true);
  const [projectLimit, setProjectLimit] = React.useState<ProjectLimit | null>(null);
  const [adminUserId, setAdminUserId] = React.useState<string | null>(null);
  const [adminOpen, setAdminOpen] = React.useState(pathname.startsWith('/admin'));
  const [projectSearch, setProjectSearch] = React.useState("");

  // Read initial activeOrg from localStorage if available
  const [activeOrg, setActiveOrg] = React.useState<SidebarOrg | null>(null);

  const [projectToDelete, setProjectToDelete] = React.useState<string | null>(null);

  // Sync activeOrg to localStorage
  React.useEffect(() => {
    if (activeOrg) {
      localStorage.setItem("kyte-active-org", activeOrg.id);
    }
  }, [activeOrg]);

  // Create Organization modal state
  const [showCreateOrg, setShowCreateOrg] = React.useState(false);
  const [newOrgName, setNewOrgName] = React.useState("");
  const [newOrgSlug, setNewOrgSlug] = React.useState("");
  const [createOrgLoading, setCreateOrgLoading] = React.useState(false);
  const [createOrgError, setCreateOrgError] = React.useState("");

  // Fetch organizations only
  React.useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      (async () => {
      try {
        setOrganizationsLoading(true);
        const orgsRes = await apiRequest('GET', '/organizations');
        if (controller.signal.aborted) return;
        const nextOrganizations = orgsRes.organizations || [];
        setOrganizations(nextOrganizations);
        if (nextOrganizations.length > 0) {
          
          const savedOrgId = localStorage.getItem("kyte-active-org");
          const savedOrg = nextOrganizations.find((o: SidebarOrg) => o.id === savedOrgId);
          const nextActiveOrg = savedOrg || nextOrganizations[0];
          setActiveOrg(nextActiveOrg);
          localStorage.setItem("kyte-active-org", nextActiveOrg.id);
        } else {
          setActiveOrg(null);
          localStorage.removeItem("kyte-active-org");
          // Only redirect if the request succeeded but returned empty orgs
          if (pathname !== '/onboarding') {
            window.location.href = '/onboarding';
          }
        }
      } catch (e) {
        console.error("Failed to load sidebar data", e);
        // Do NOT redirect on error — the error could be transient
      }
      finally {
        if (!controller.signal.aborted) setOrganizationsLoading(false);
      }
      })();
    }, 0);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [pathname, apiRequest, isLoaded, isSignedIn]);

  React.useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      try {
        const [limit, account] = await Promise.all([
          apiRequest('GET', '/projects/limits'),
          apiRequest('GET', '/auth/me'),
        ]);
        setProjectLimit(limit);
        setAdminUserId(account.isAdmin ? userId : null);
      } catch (error) {
        console.error("Failed to load project allowance", error);
      }
    })();
  }, [pathname, apiRequest, isLoaded, isSignedIn, userId]);

  // Fetch projects scoped to activeOrg whenever activeOrg changes
  React.useEffect(() => {
    if (!activeOrg) return;
    (async () => {
      try {
        const projRes = await apiRequest('GET', `/projects?organizationId=${activeOrg.id}`);
        setProjects(projRes.projects || []);
      } catch (e) {
        console.error("Failed to load projects", e);
      }
    })();
  }, [activeOrg, apiRequest]);

  // Track latest deployments and notify
  const lastDeploymentStatuses = React.useRef<Record<string, string>>({});
  
  React.useEffect(() => {
    if (!activeOrg) return;
    const interval = setInterval(async () => {
      try {
        const res = await apiRequest('GET', `/organizations/${activeOrg.id}/deployments`);
        const deployments = res.deployments || [];
        
        deployments.forEach((d: SidebarDeployment) => {
          const prevStatus = lastDeploymentStatuses.current[d.id];
          
          if (prevStatus && prevStatus !== d.status) {
            if (d.status === 'SUCCESS') {
              toast.success(`${d.project?.name || 'Project'} deployed successfully!`, {
                description: `Commit ${d.commitSha?.slice(0, 7) || ''} is now live.`
              });
            } else if (d.status === 'FAILED') {
              toast.error(`${d.project?.name || 'Project'} deployment failed.`, {
                description: `Commit ${d.commitSha?.slice(0, 7) || ''} could not be built.`
              });
            }
          }
          
          lastDeploymentStatuses.current[d.id] = d.status;
        });
      } catch {
        // silently fail polling
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeOrg, apiRequest]);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateOrgError("");
    setCreateOrgLoading(true);
    try {
      const res = await apiRequest("POST", "/organizations", { name: newOrgName, slug: newOrgSlug });
      const newOrg: SidebarOrg = res.organization || { id: res.id, name: newOrgName };
      setOrganizations((prev) => [...prev, newOrg]);
      setActiveOrg(newOrg);
      localStorage.setItem("kyte-active-org", newOrg.id);
      setShowCreateOrg(false);
      setNewOrgName("");
      setNewOrgSlug("");
      window.location.href = '/dashboard';
    } catch (cause) {
      const requestError = cause as RequestError;
      console.error(cause);
      setCreateOrgError(requestError.message || "Could not create organization.");
    } finally {
      setCreateOrgLoading(false);
    }
  };

  return (
    <>
      <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border bg-sidebar" {...props}>
        <SidebarHeader className="border-b border-sidebar-border bg-sidebar p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <SidebarMenuButton
                    size="lg"
                    data-slot="team-switcher"
                    className="w-full justify-between rounded-lg border border-sidebar-border bg-zinc-900/40 text-sidebar-foreground shadow-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  />
                }>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-950 text-zinc-300">
                        <Command className="size-3.5" />
                      </div>
                      <span className="font-semibold text-sm truncate">{organizationsLoading ? 'Loading workspace...' : activeOrg ? activeOrg.name : 'No Organization'}</span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-popover border-border text-popover-foreground">
                  {organizations.map(org => (
                    <DropdownMenuItem
                      key={org.id}
                      className="flex items-center gap-2 hover:bg-accent focus:bg-accent cursor-pointer"
                      onClick={() => {
                        setActiveOrg(org);
                        localStorage.setItem("kyte-active-org", org.id);
                        window.location.href = '/dashboard';
                      }}
                    >
                      <Building2 className="size-4 text-muted-foreground" />
                      <span className="truncate">{org.name}</span>
                    </DropdownMenuItem>
                  ))}
                  {organizations.length > 0 && <DropdownMenuSeparator className="bg-border" />}
                  <DropdownMenuItem
                    className="hover:bg-accent focus:bg-accent cursor-pointer text-muted-foreground"
                    onClick={() => setShowCreateOrg(true)}
                  >
                    <PlusIcon className="w-4 h-4 mr-2" /> Create Organization
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent className="bg-sidebar px-2 py-3">
          <SidebarGroup className="px-0 py-0 mb-4">
            <Button className="h-9 w-full rounded-md bg-white text-[13px] font-medium text-black hover:bg-zinc-200" render={<Link href="/new" />}>
              <PlusIcon className="size-3.5" /> Create Project
            </Button>
          </SidebarGroup>

          <SidebarGroup className="px-0 py-0">
            <SidebarGroupLabel className="mb-1 px-2.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Workspace</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === '/dashboard'}
                  tooltip="Overview"
                  className="h-9 rounded-md px-2.5 text-[13px] font-medium"
                  render={<Link href="/dashboard" />}
                >
                  <LayoutDashboard />
                  <span>Overview</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === '/dashboard/deployments'}
                  tooltip="Deployments"
                  className="h-9 rounded-md px-2.5 text-[13px] font-medium"
                  render={<Link href="/dashboard/deployments" />}
                >
                  <Rocket />
                  <span>Deployments</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === '/settings'}
                  tooltip="Settings"
                  className="h-9 rounded-md px-2.5 text-[13px] font-medium"
                  render={<Link href="/settings" />}
                >
                  <Settings2 />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {adminUserId === userId && (
                <SidebarMenuItem>
                  <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
                    <CollapsibleTrigger
                      render={
                        <SidebarMenuButton
                          isActive={pathname.startsWith('/admin')}
                          tooltip="Admin"
                          className="h-9 rounded-md px-2.5 text-[13px] font-medium"
                        />
                      }
                    >
                      <ShieldCheck />
                      <span>Admin</span>
                      <ChevronRight className={cn("ml-auto transition-transform", adminOpen && "rotate-90")} />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {[
                          { href: '/admin', label: 'Overview' },
                          { href: '/admin/users', label: 'Users' },
                          { href: '/admin/sites', label: 'Hosted sites' },
                          { href: '/admin/deployments', label: 'Deployments' },
                          { href: '/admin/settings', label: 'Settings' },
                        ].map((item) => (
                          <SidebarMenuSubItem key={item.href}>
                            <SidebarMenuSubButton
                              isActive={pathname === item.href}
                              render={<Link href={item.href} />}
                            >
                              {item.label}
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroup>
          <SidebarGroup className="mt-5 px-0 py-0 flex-1 min-h-0 flex flex-col">
            <SidebarGroupLabel className="mb-1 flex shrink-0 items-center justify-between px-2.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              Recent projects
            </SidebarGroupLabel>
            <div className="px-2 mb-3 relative shrink-0">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
              <Input 
                placeholder="Search projects..." 
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="h-8 text-xs bg-sidebar-accent/50 border border-border/50 pl-8 focus-visible:ring-1 focus-visible:ring-ring rounded-md"
              />
            </div>
            <div className="app-scroll min-h-0 flex-1 overflow-y-auto pb-4">
              <SidebarMenu>
                {projects.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase())).map((project) => {
                const isActive = pathname.includes(`/projects/${project.id}`);
                return (
                  <SidebarMenuItem key={project.id} className="w-full">
                    <SidebarMenuButton
                      tooltip={project.name}
                      className={`h-9 w-full rounded-md px-2.5 text-[13px] font-medium transition-colors group/button ${
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      }`}
                      render={<Link href={`/projects/${project.id}`} />}
                    >
                      <AppWindow className={isActive ? 'mr-2 size-3.5 shrink-0 text-zinc-200' : 'mr-2 size-3.5 shrink-0 text-muted-foreground'} />
                      <span className="flex-1 truncate">{project.name}</span>
                    </SidebarMenuButton>

                    <DropdownMenu>
                      <DropdownMenuTrigger render={
                        <SidebarMenuAction className="text-muted-foreground hover:text-foreground hover:bg-sidebar-accent mr-1" />
                      }>
                        <MoreHorizontal className="size-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-48 bg-popover border-border text-popover-foreground" side="right" align="start">
                        <DropdownMenuItem className="hover:bg-accent focus:bg-accent cursor-pointer text-[13px]">
                          <ExternalLink className="size-3.5 mr-2" />
                          Visit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-border" />
                        <DropdownMenuItem className="hover:bg-destructive/10 focus:bg-destructive/10 text-destructive cursor-pointer text-[13px]" onClick={() => {
                          setProjectToDelete(project.id);
                        }}>
                          <Trash2 className="size-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                );
              })}
              </SidebarMenu>
            </div>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border bg-sidebar p-3">
          <div className="flex flex-col gap-3">
            {projectLimit && (
              <Link
                href="/settings#usage"
                className="group flex flex-col gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3 transition-colors hover:bg-sidebar-accent/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-sidebar-foreground">Project usage</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {projectLimit.remaining === 0
                        ? 'No slots remaining'
                        : `${projectLimit.remaining} ${projectLimit.remaining === 1 ? 'slot' : 'slots'} remaining`}
                    </p>
                  </div>
                  <span className="font-mono text-xs font-medium text-sidebar-foreground">
                    {projectLimit.used} of {projectLimit.limit}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Project allowance used"
                  aria-valuemin={0}
                  aria-valuemax={projectLimit.limit}
                  aria-valuenow={projectLimit.used}
                  className="flex gap-1"
                >
                  {Array.from({ length: projectLimit.limit }, (_, index) => (
                    <span
                      key={index}
                      className={cn(
                        "h-1.5 flex-1 rounded-full transition-colors",
                        index < projectLimit.used
                          ? "bg-sidebar-primary-foreground"
                          : "bg-sidebar-accent",
                      )}
                    />
                  ))}
                </div>
              </Link>
            )}
            <Separator />
            <NavUser />
          </div>
        </SidebarFooter>
      </Sidebar>

      <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your project and remove all data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (projectToDelete) {
                  try {
                    await apiRequest('DELETE', `/projects/${projectToDelete}`);
                    if (window.location.pathname.includes(`/projects/${projectToDelete}`)) {
                      window.location.href = '/dashboard';
                    } else {
                      window.location.reload();
                    }
                  } catch {
                    toast.error("Failed to delete project");
                  }
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Organization Modal */}
      {showCreateOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/40">
            <button
              type="button"
              onClick={() => { setShowCreateOrg(false); setCreateOrgError(""); }}
              className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-zinc-900 hover:text-foreground"
            >
              <X className="size-5" />
            </button>
            <div className="border-b border-zinc-800 px-6 pb-5 pt-6 sm:px-7">
              <div className="mb-3 flex size-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300"><Building2 className="size-4" /></div>
              <h2 className="text-lg font-semibold tracking-[-0.02em]">Create organization</h2>
              <p className="mt-1 text-[13px] leading-5 text-muted-foreground">A workspace for your projects, deployments, and team.</p>
            </div>
            <form onSubmit={handleCreateOrg} className="flex flex-col gap-5 px-6 py-5 sm:px-7">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Organization Name</label>
                <Input
                  value={newOrgName}
                  onChange={(e) => {
                    setNewOrgName(e.target.value);
                    setNewOrgSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
                  }}
                  placeholder="Acme Corp"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Organization URL</label>
                <div className="flex items-center">
                  <span className="rounded-l-md border border-r-0 border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-500">
                    kyte.com/
                  </span>
                  <Input
                    value={newOrgSlug}
                    onChange={(e) => setNewOrgSlug(e.target.value)}
                    className="rounded-l-none"
                    required
                  />
                </div>
                <p className="text-xs leading-5 text-muted-foreground">Use lowercase letters, numbers, and hyphens.</p>
              </div>
              {createOrgError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <p>{createOrgError}</p>
                </div>
              )}
              <div className="-mx-6 -mb-5 mt-1 flex justify-end gap-2 border-t border-zinc-800 bg-zinc-900/30 px-6 py-3 sm:-mx-7 sm:px-7">
                <Button type="button" variant="ghost" onClick={() => { setShowCreateOrg(false); setCreateOrgError(""); }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createOrgLoading}>
                  {createOrgLoading ? "Creating..." : "Create"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
