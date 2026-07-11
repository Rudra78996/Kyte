"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useUser, useClerk } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import BoringAvatar from "boring-avatars"
import {
  BadgeCheck,
  Bell,
  MoreHorizontal,
  LogOut,
  FileText,
  Monitor,
  Sun,
  Moon,
  SunMoon
} from "lucide-react"
import { cn } from "@/lib/utils"

export function NavUser() {
  const { isMobile } = useSidebar()
  const { isLoaded, user } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  if (!isLoaded || !user) return null

  const name = user.username || user.fullName || 'User'
  const email = user.primaryEmailAddress?.emailAddress || ''

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex items-center justify-between w-full p-2 mb-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <BoringAvatar size={28} name={name} variant="beam" colors={["#00686c","#32c2b9","#edecb3","#fad928","#ff9915"]} />
            <span className="text-sm font-medium text-neutral-300 truncate">{name}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button className="flex items-center justify-center size-7 rounded-full border border-neutral-800 hover:bg-neutral-800 text-neutral-400 transition-colors outline-none" />
                }
              >
                <MoreHorizontal className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 rounded-lg border-neutral-800 bg-neutral-950 text-neutral-200 shadow-xl"
                side={isMobile ? "bottom" : "top"}
                align="end"
                sideOffset={8}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <BoringAvatar size={32} name={name} variant="beam" colors={["#00686c","#32c2b9","#edecb3","#fad928","#ff9915"]} />
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold text-white">{name}</span>
                        <span className="truncate text-xs text-neutral-400">{email}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-neutral-800" />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => router.push('/dashboard/settings')} className="hover:bg-neutral-800 focus:bg-neutral-800 cursor-pointer">
                    <BadgeCheck className="mr-2 size-4" />
                    Manage Account
                  </DropdownMenuItem>
                  
                  {/* Theme Switcher Item */}
                  <div className="flex items-center justify-between px-2 py-1.5 text-sm outline-none">
                    <div className="flex items-center">
                      <SunMoon className="mr-2 size-4" />
                      <span>Theme</span>
                    </div>
                    <div className="flex items-center rounded-full border border-neutral-800 bg-black p-0.5">
                      <button 
                        onClick={(e) => { e.preventDefault(); setTheme('system'); }}
                        className={cn("flex items-center justify-center size-6 rounded-full transition-colors", theme === 'system' ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300")}
                      >
                        <Monitor className="size-3" />
                      </button>
                      <button 
                        onClick={(e) => { e.preventDefault(); setTheme('light'); }}
                        className={cn("flex items-center justify-center size-6 rounded-full transition-colors", theme === 'light' ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300")}
                      >
                        <Sun className="size-3" />
                      </button>
                      <button 
                        onClick={(e) => { e.preventDefault(); setTheme('dark'); }}
                        className={cn("flex items-center justify-center size-6 rounded-full transition-colors", theme === 'dark' ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300")}
                      >
                        <Moon className="size-3" />
                      </button>
                    </div>
                  </div>

                  <DropdownMenuItem className="hover:bg-neutral-800 focus:bg-neutral-800 cursor-pointer">
                    <FileText className="mr-2 size-4" />
                    Docs
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-neutral-800" />
                <DropdownMenuItem className="text-red-500 hover:text-red-400 focus:text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 cursor-pointer" onClick={() => signOut()}>
                  <LogOut className="mr-2 size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button className="flex items-center justify-center size-7 rounded-full border border-neutral-800 hover:bg-neutral-800 text-neutral-400 transition-colors outline-none" />
                }
              >
                <Bell className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-64 rounded-lg border-neutral-800 bg-neutral-950 text-neutral-200 shadow-xl p-3"
                side={isMobile ? "bottom" : "top"}
                align="end"
                sideOffset={8}
              >
                <div className="font-semibold text-sm mb-2 text-white">Notifications</div>
                <div className="text-xs text-neutral-400 flex flex-col gap-2">
                  <div className="p-2 rounded bg-neutral-900 border border-neutral-800">
                    <p className="text-white mb-1 text-sm font-medium">Deployment successful</p>
                    <p>production branch is live</p>
                    <p className="text-[10px] mt-1 text-neutral-500">2 hours ago</p>
                  </div>
                  <div className="p-2 rounded bg-neutral-900 border border-neutral-800">
                    <p className="text-white mb-1 text-sm font-medium">Welcome to Kyte</p>
                    <p>Start building your first project</p>
                    <p className="text-[10px] mt-1 text-neutral-500">1 day ago</p>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

          </div>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
