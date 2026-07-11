"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import Image from "next/image"
import Link from "next/link"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  FolderKanbanIcon,
  HomeIcon,
  BoxIcon,
  ListIcon,
  LineChartIcon,
  SettingsIcon,
  BookOpenIcon,
  PlusIcon,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  Settings2
} from "lucide-react"

// Kyte Platform Sidebar Data
const data = {
  teams: [
    {
      name: "Kyte Platform",
      plan: "Pro",
    },
    {
      name: "Personal Workspace",
      plan: "Hobby",
    },
  ],
  navMain: [
    {
      title: "Projects",
      url: "/dashboard",
      icon: <HomeIcon className="size-4" />,
    },
    {
      title: "Deployments",
      url: "/dashboard/deployments",
      icon: <BoxIcon className="size-4" />,
    },
    {
      title: "Logs",
      url: "/dashboard/logs",
      icon: <ListIcon className="size-4" />,
    },
    {
      title: "Analytics",
      url: "/dashboard/analytics",
      icon: <LineChartIcon className="size-4" />,
    },
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: <SettingsIcon className="size-4" />,
    },
    {
      title: "Docs",
      url: "/docs",
      icon: <BookOpenIcon className="size-4" />,
    },
  ],
  recentProjects: [
    { name: "kyte-web", url: "/projects/kyte-web" },
    { name: "kyte-api", url: "/projects/kyte-api" },
    { name: "portfolio", url: "/projects/portfolio" },
  ]
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  const navMainWithActive = data.navMain.map(item => ({
    ...item,
    isActive: pathname === item.url || pathname.startsWith(item.url + '/') && item.url !== '/dashboard'
  }));
  // Special case for dashboard to not match everything
  navMainWithActive[0].isActive = pathname === '/dashboard';

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              size="lg" 
              render={<a href="/dashboard" />}
            >
              <div className="flex items-center gap-3">
                <Image 
                  src="/kite-flying.png" 
                  alt="Kyte Logo" 
                  width={24} 
                  height={24} 
                  className="object-contain invert dark:invert"
                />
                <span className="font-sans text-xl font-bold tracking-[0.15em] transition-colors italic flex items-center pt-0.5">
                  <span className="text-neutral-400">K</span>yte
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMainWithActive} />
        
        <div className="mx-4 mt-2 mb-0 h-[1px] bg-neutral-800" />
        
        <SidebarGroup className="px-2 pt-1">
          <SidebarGroupLabel className="text-xs font-medium text-neutral-500 mb-1">
            Recent Projects
          </SidebarGroupLabel>
          <SidebarGroupAction title="Add Project" className="text-neutral-400 hover:text-neutral-200 transition-colors">
            <PlusIcon className="size-3.5" />
          </SidebarGroupAction>
          <SidebarMenu>
            {data.recentProjects.map((project) => (
              <SidebarMenuItem key={project.name} className="w-full mb-[2px]">
                <SidebarMenuButton 
                  tooltip={project.name}
                  className="w-full h-8 text-[13px] px-2.5 font-medium transition-colors text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 group/button"
                  render={<Link href={project.url} />}
                >
                  <BoxIcon className="size-4 mr-1.5" />
                  <span className="flex-1 truncate">{project.name}</span>
                </SidebarMenuButton>
                
                <DropdownMenu>
                  <DropdownMenuTrigger render={<SidebarMenuAction className="text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800" />}>
                    <MoreHorizontal className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48 bg-neutral-950 border-neutral-800 text-neutral-200" side="right" align="start">
                    <DropdownMenuItem className="hover:bg-neutral-800 focus:bg-neutral-800 cursor-pointer text-[13px]">
                      <ExternalLink className="size-3.5 mr-2" />
                      View Deployment
                    </DropdownMenuItem>
                    <DropdownMenuItem className="hover:bg-neutral-800 focus:bg-neutral-800 cursor-pointer text-[13px]">
                      <Settings2 className="size-3.5 mr-2" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-neutral-800" />
                    <DropdownMenuItem className="hover:bg-red-500/10 focus:bg-red-500/10 text-red-500 cursor-pointer text-[13px]">
                      <Trash2 className="size-3.5 mr-2" />
                      Delete Project
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
