"use client"

import * as React from "react"
import Link from "next/link"
import { SearchIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarInput,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: React.ReactNode
    isActive?: boolean
  }[]
}) {
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search if user presses 'f' and not currently typing in an input
      if (e.key.toLowerCase() === 'f' && 
          document.activeElement?.tagName !== 'INPUT' && 
          document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <SidebarGroup className="px-2">
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="relative mb-3 mt-1 group">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <SidebarInput 
              ref={searchInputRef}
              placeholder="Find" 
              className="pl-9 pr-7 h-8 text-[13px] border-neutral-800 bg-transparent transition-all hover:bg-neutral-900/50 text-neutral-200 focus-visible:border-neutral-500 focus-visible:ring-[3px] focus-visible:ring-neutral-600/30 focus-visible:ring-offset-0" 
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded border border-neutral-800 bg-transparent text-[10px] font-medium text-muted-foreground group-focus-within:hidden">
              F
            </kbd>
          </div>
        </SidebarMenuItem>
        
        {items.map((item) => (
          <SidebarMenuItem key={item.title} className="w-full mb-[2px]">
            <SidebarMenuButton 
              tooltip={item.title} 
              isActive={item.isActive}
              className="w-full h-8 text-[13px] gap-2.5 px-2.5 font-medium transition-colors text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 data-[active=true]:bg-[#2a2a2a] data-[active=true]:text-neutral-100"
              render={<Link href={item.url} />}
            >
              {item.icon}
              <span>{item.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
