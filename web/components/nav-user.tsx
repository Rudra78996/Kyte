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

interface Notification {
  id: string
  title: string
  message: string
  type: "SUCCESS" | "ERROR" | "INFO"
  read: boolean
  createdAt: string
}

function formatNotificationTime(value: string) {
  const elapsed = Date.now() - new Date(value).getTime()
  const minutes = Math.max(0, Math.floor(elapsed / 60000))
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function NavUser() {
  const { isMobile } = useSidebar()
  const { isLoaded, user } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()
  const apiRequest = useApiRequest()
  const [notifications, setNotifications] = useState<Notification[]>([])
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
      } catch {
        console.error("Failed to fetch notifications");
      }
    };
    
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
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
                className="w-[22rem] overflow-hidden p-0"
                side={isMobile ? "bottom" : "top"}
                align="end"
                sideOffset={8}
              >
                <div className="flex items-center justify-between border-b border-border bg-zinc-900/40 px-4 py-3">
                  <div><span className="text-sm font-medium">Notifications</span><p className="mt-0.5 text-[11px] text-muted-foreground">Deployment and project activity</p></div>
                  {notifications.length > 0 && (
                    <Badge variant="outline" className="border-zinc-700 bg-zinc-950 px-2 py-0.5 font-mono text-[10px] font-medium text-zinc-400">
                      {notifications.length} {notifications.length === 1 ? 'event' : 'events'}
                    </Badge>
                  )}
                </div>
                <div className="app-scroll max-h-[360px] overflow-y-auto bg-zinc-950/30">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                      <div className="mb-3 flex size-9 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400"><Bell className="size-4" /></div>
                      <p className="text-sm font-medium text-zinc-300">You&apos;re all caught up</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">Project activity and deployment updates will appear here.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                    {notifications.map((notif) => (
                      <div key={notif.id} className="group flex gap-3 px-4 py-3 transition-colors hover:bg-zinc-900/60">
                        <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border ${notif.type === 'SUCCESS' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : notif.type === 'ERROR' ? 'border-red-500/20 bg-red-500/10 text-red-400' : 'border-zinc-800 bg-zinc-900 text-zinc-400'}`}>
                          {notif.type === 'SUCCESS' ? (
                            <CheckCircle2 className="size-4" />
                          ) : notif.type === 'ERROR' ? (
                            <AlertCircle className="size-4" />
                          ) : (
                            <Info className="size-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2"><p className="min-w-0 flex-1 truncate text-[13px] font-medium leading-5 text-zinc-200">{notif.title}</p>{!notif.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-zinc-300" />}</div>
                          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{notif.message}</p>
                          <p className="mt-1 font-mono text-[10px] text-zinc-600">{formatNotificationTime(notif.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                    </div>
                  )}
                </div>
                {notifications.length > 0 && <div className="border-t border-border bg-zinc-900/30 px-4 py-2 text-[11px] text-zinc-500">New activity is checked automatically.</div>}
              </DropdownMenuContent>
            </DropdownMenu>

          </div>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
