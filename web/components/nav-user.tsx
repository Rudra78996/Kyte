"use client"

import { Badge } from "@/components/ui/badge"

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
import { useApiRequest } from "@/hooks/use-api"
import { useEffect, useState, useRef } from "react"
import {
  BadgeCheck,
  Bell,
  MoreHorizontal,
  LogOut,
  FileText,
  CheckCircle2,
  AlertCircle,
  Info
} from "lucide-react"

export function NavUser() {
  const { isMobile } = useSidebar()
  const { isLoaded, user } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()
  const apiRequest = useApiRequest()
  const [notifications, setNotifications] = useState<any[]>([])
  const [hasUnread, setHasUnread] = useState(false)
  const lastLenRef = useRef(0)

  useEffect(() => {
    if (notifications.length > lastLenRef.current) {
      setHasUnread(true)
    }
    lastLenRef.current = notifications.length
  }, [notifications.length])

  useEffect(() => {
    if (!isLoaded || !user) return;
    const fetchNotifications = async () => {
      try {
        const data = await apiRequest('GET', '/notifications');
        if (data.notifications) {
          setNotifications(data.notifications);
        }
      } catch (e) {
        console.error("Failed to fetch notifications");
      }
    };
    
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [isLoaded, user, apiRequest]);

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
            
            <DropdownMenu onOpenChange={(open) => { if (open) setHasUnread(false) }}>
              <DropdownMenuTrigger
                render={
                  <button className="relative flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground outline-none" />
                }
              >
                <Bell className="size-3.5" />
                {hasUnread && (
                  <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-red-500 ring-2 ring-sidebar" />
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-80 p-0 overflow-hidden"
                side={isMobile ? "bottom" : "top"}
                align="end"
                sideOffset={8}
              >
                <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
                  <span className="text-sm font-medium">Notifications</span>
                  {notifications.length > 0 && (
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-transparent border-transparent text-muted-foreground">
                      {notifications.length}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-col gap-3 p-3 max-h-[350px] overflow-y-auto bg-muted/10">
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">No new notifications</div>
                  ) : (
                    notifications.map((notif) => (
                      <div key={notif.id} className="flex gap-3 p-3 rounded-lg border border-border bg-card shadow-sm transition-colors hover:bg-muted/50 cursor-default">
                        <div className="shrink-0 mt-0.5">
                          {notif.type === 'SUCCESS' ? (
                            <CheckCircle2 className="size-4 text-emerald-500" />
                          ) : notif.type === 'ERROR' ? (
                            <AlertCircle className="size-4 text-red-500" />
                          ) : (
                            <Info className="size-4 text-foreground" />
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                          <p className="text-sm font-medium leading-none text-foreground">
                            {notif.title}
                          </p>
                          <p className="text-[13px] text-muted-foreground leading-snug">
                            {notif.message}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

          </div>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
