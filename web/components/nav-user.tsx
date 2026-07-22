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
import { UserAvatar } from "@/components/user-avatar"
import {
  BadgeCheck,
  MoreHorizontal,
  LogOut,
  FileText,
} from "lucide-react"

export function NavUser() {
  const { isMobile } = useSidebar()
  const { isLoaded, user } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()
  if (!isLoaded || !user) return null

  const name = user.username || user.fullName || 'User'
  const email = user.primaryEmailAddress?.emailAddress || ''

  return (
    <SidebarMenu data-slot="nav-user">
      <SidebarMenuItem>
        <div className="flex w-full items-center justify-between rounded-md p-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="rounded-full border border-border p-0.5 shrink-0 bg-background/50 shadow-sm flex items-center justify-center">
              <UserAvatar size={26} name={name} />
            </div>
            <span className="truncate text-sm font-medium text-sidebar-foreground">{name}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground outline-none" />
                }
              >
                <MoreHorizontal className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56"
                side={isMobile ? "bottom" : "top"}
                align="end"
                sideOffset={8}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <div className="rounded-full border border-border p-0.5 shrink-0 bg-background/50 shadow-sm flex items-center justify-center">
                        <UserAvatar size={30} name={name} />
                      </div>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">{name}</span>
                        <span className="truncate text-xs text-muted-foreground">{email}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => router.push('/settings')} className="cursor-pointer">
                    <BadgeCheck className="mr-2 size-4" />
                    Manage Account
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">
                    <FileText className="mr-2 size-4" />
                    Docs
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" className="cursor-pointer" onClick={() => signOut()}>
                  <LogOut className="mr-2 size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
