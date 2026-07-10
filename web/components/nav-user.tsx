"use client"

import { UserButton, useUser } from "@clerk/nextjs"
import { dark } from "@clerk/themes"
import {
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavUser() {
  const { state } = useSidebar()
  const { isLoaded, user } = useUser()

  if (!isLoaded || !user) return null

  return (
    <SidebarMenu>
      <SidebarMenuItem className="flex items-center p-2 hover:bg-sidebar-accent rounded-md transition-colors">
        <div className="flex w-full items-center gap-3 overflow-hidden">
          <div className="shrink-0 flex items-center justify-center">
            <UserButton appearance={{ baseTheme: dark } as any} />
          </div>
          {state !== "collapsed" && (
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium text-sidebar-foreground">{user.fullName || user.username || 'User'}</span>
              <span className="truncate text-xs text-muted-foreground">{user.primaryEmailAddress?.emailAddress}</span>
            </div>
          )}
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
