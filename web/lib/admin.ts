export type PlatformSettings = {
  deploymentsPaused: boolean;
  defaultProjectLimit: number;
};

export type AdminDeployment = {
  id: string;
  status: string;
  commitSha: string;
  triggerSource: string;
  branch: string;
  deployedAt: string;
  project: {
    id: string;
    name: string;
    subdomain: string;
    user: { email: string };
  };
};

export type AdminOverview = {
  users: number;
  projects: number;
  deployments: number;
  activeDeployments: number;
  activeDeploymentItems: AdminDeployment[];
  settings: PlatformSettings;
};

export type AdminUser = {
  id: string;
  email: string;
  username?: string | null;
  role: "USER" | "ADMIN";
  projectLimitOverride?: number | null;
  createdAt: string;
  _count: { projects: number; githubConnections?: number };
};

export type AdminProject = {
  id: string;
  name: string;
  subdomain: string;
  repoUrl: string;
  user: { email: string; username?: string | null };
  activeDeploy?: { status: string } | null;
  _count: { deployments: number; requestLogs?: number; customDomains: number };
};

export const ADMIN_PAGE_SIZE = 25;
export const ACTIVE_DEPLOYMENT_STATUSES = ["QUEUED", "BUILDING", "UPLOADING"];

export function formatAdminDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function adminStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "SUCCESS") return "default";
  if (status === "FAILED" || status === "TIMEOUT") return "destructive";
  if (ACTIVE_DEPLOYMENT_STATUSES.includes(status)) return "secondary";
  return "outline";
}
