"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  FolderKanbanIcon,
  RocketIcon,
  GlobeIcon,
  Settings2Icon,
  ActivitySquareIcon,
  DatabaseZapIcon,
  ShieldCheckIcon,
  ZapIcon,
  TerminalSquareIcon,
} from "lucide-react"

const KyteLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0">
    <path d="M11.5 2.5 4 10l8 12 8-12-7.5-7.5z" />
    <path d="M12 22V10" />
    <path d="m4 10 16 0" />
  </svg>
)

// Kyte Platform Sidebar Data
const data = {
  teams: [
    {
      name: "Kyte Platform",
      logo: <KyteLogo />,
      plan: "Pro",
    },
    {
      name: "Personal Workspace",
      logo: <FolderKanbanIcon className="size-4 shrink-0" />,
      plan: "Hobby",
    },
  ],
  navMain: [
    {
      title: "Projects",
      url: "/dashboard",
      icon: (
        <FolderKanbanIcon
        />
      ),
      isActive: true,
      items: [
        {
          title: "All Projects",
          url: "/dashboard",
        },
        {
          title: "Deployments",
          url: "/dashboard/deployments",
        },
      ],
    },
    {
      title: "Infrastructure",
      url: "#",
      icon: (
        <DatabaseZapIcon
        />
      ),
      items: [
        {
          title: "Storage",
          url: "#",
        },
        {
          title: "Edge Config",
          url: "#",
        },
        {
          title: "Databases",
          url: "#",
        },
      ],
    },
    {
      title: "Networking",
      url: "#",
      icon: (
        <GlobeIcon
        />
      ),
      items: [
        {
          title: "Domains",
          url: "#",
        },
        {
          title: "Firewall",
          url: "#",
        },
        {
          title: "CDN Routing",
          url: "#",
        },
      ],
    },
    {
      title: "Observability",
      url: "#",
      icon: (
        <ActivitySquareIcon
        />
      ),
      items: [
        {
          title: "Logs",
          url: "#",
        },
        {
          title: "Speed Insights",
          url: "#",
        },
        {
          title: "Web Analytics",
          url: "#",
        },
      ],
    },
    {
      title: "Settings",
      url: "#",
      icon: (
        <Settings2Icon
        />
      ),
      items: [
        {
          title: "General",
          url: "#",
        },
        {
          title: "Environment Variables",
          url: "#",
        },
        {
          title: "Billing",
          url: "#",
        },
        {
          title: "Security",
          url: "#",
        },
      ],
    },
  ],
  projects: [
    {
      name: "API Gateway",
      url: "#",
      icon: (
        <ZapIcon
        />
      ),
    },
    {
      name: "Auth Service",
      url: "#",
      icon: (
        <ShieldCheckIcon
        />
      ),
    },
    {
      name: "Background Worker",
      url: "#",
      icon: (
        <TerminalSquareIcon
        />
      ),
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  const navMainWithActive = data.navMain.map(item => ({
    ...item,
    isActive: pathname.startsWith(item.url) && item.url !== "#"
  }));

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMainWithActive} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
