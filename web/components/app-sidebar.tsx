"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import Link from "next/link"
import { useApiRequest } from "@/hooks/use-api"
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
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  BoxIcon,
  PlusIcon,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  ChevronDown
} from "lucide-react"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const router = useRouter();
  const apiRequest = useApiRequest();
  const [projects, setProjects] = React.useState<any[]>([]);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest('GET', '/projects');
        setProjects(res.projects || []);
      } catch (e) {
        console.error("Failed to load projects", e);
      }
    })();
  }, []);

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-[#1E1E1E] bg-[#000]" {...props}>
      <SidebarHeader className="border-b border-[#1E1E1E] p-4 bg-[#000]">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <SidebarMenuButton 
                  size="lg" 
                  className="w-full justify-between hover:bg-[#111] text-gray-200"
                />
              }>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white shadow-inner shrink-0">
                      A
                    </div>
                    <span className="font-semibold text-sm">Acme Inc.</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-[#0A0A0A] border-[#1E1E1E] text-gray-200">
                <DropdownMenuItem className="hover:bg-[#111] focus:bg-[#111] cursor-pointer">
                  Acme Inc.
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#1E1E1E]" />
                <DropdownMenuItem className="hover:bg-[#111] focus:bg-[#111] cursor-pointer text-gray-400">
                  <PlusIcon className="w-4 h-4 mr-2" /> Create Organization
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="bg-[#000] px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-bold tracking-widest text-gray-500 mb-2 px-2 uppercase">
            Projects
          </SidebarGroupLabel>
          <SidebarMenu>
            {projects.map((project) => {
              const isActive = pathname.includes(`/projects/${project.id}`);
              return (
                <SidebarMenuItem key={project.id} className="w-full mb-1">
                  <SidebarMenuButton 
                    tooltip={project.name}
                    className={`w-full h-9 text-[13px] px-3 font-medium transition-colors rounded-md group/button ${
                      isActive 
                        ? 'bg-[#111] text-white' 
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#111]/50'
                    }`}
                    render={<Link href={`/projects/${project.id}`} />}
                  >
                    <BoxIcon className={`w-4 h-4 mr-2 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                    <span className="flex-1 truncate">{project.name}</span>
                  </SidebarMenuButton>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger render={
                      <SidebarMenuAction className="text-gray-500 hover:text-white hover:bg-[#222] mr-1" />
                    }>
                      <MoreHorizontal className="size-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-48 bg-[#0A0A0A] border-[#1E1E1E] text-gray-200" side="right" align="start">
                      <DropdownMenuItem className="hover:bg-[#111] focus:bg-[#111] cursor-pointer text-[13px]">
                        <ExternalLink className="size-3.5 mr-2" />
                        Visit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-[#1E1E1E]" />
                      <DropdownMenuItem className="hover:bg-red-500/10 focus:bg-red-500/10 text-[#FF5555] cursor-pointer text-[13px]" onClick={async () => {
                        if (confirm('Are you sure you want to delete this project?')) {
                           await apiRequest('DELETE', `/projects/${project.id}`);
                           window.location.reload();
                        }
                      }}>
                        <Trash2 className="size-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              );
            })}
            
            <SidebarMenuItem className="mt-4">
               <SidebarMenuButton 
                 className="w-full h-9 text-[13px] px-3 font-medium transition-colors rounded-md text-gray-400 hover:text-white hover:bg-[#111]"
                 render={<Link href="/new" />}
               >
                 <PlusIcon className="w-4 h-4 mr-2" />
                 <span className="flex-1">New project</span>
               </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-[#1E1E1E] bg-[#000] p-4">
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
