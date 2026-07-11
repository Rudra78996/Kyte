"use client";

import React from "react";
import { 
  ChevronDown, 
  Calendar, 
  Search, 
  ArrowUpCircle,
  GitCommitHorizontal,
  GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const DUMMY_DEPLOYMENTS = [
  {
    id: 1,
    message: "Add new images and updat...",
    status: "Ready",
    duration: "48s",
    environment: "Production",
    repo: "portfolio",
    repoIcon: "R",
    commitSha: "7tGrARCbh",
    isRedeploy: true,
    branch: "main",
    date: "Jul 2",
    author: "https://api.dicebear.com/9.x/notionists/svg?seed=Sophia",
  },
  {
    id: 2,
    message: "Add new images and updat...",
    status: "Ready",
    duration: "31s",
    environment: "Production",
    repo: "portfolio",
    repoIcon: "R",
    commitSha: "b55554d",
    isRedeploy: false,
    branch: "main",
    date: "Jul 2",
    author: "https://api.dicebear.com/9.x/notionists/svg?seed=Sophia",
  },
  {
    id: 3,
    message: "feat: implement custom sou...",
    status: "Ready",
    duration: "43s",
    environment: "Production",
    repo: "portfolio",
    repoIcon: "R",
    commitSha: "df89a0c",
    isRedeploy: false,
    branch: "main",
    date: "Jul 2",
    author: "https://api.dicebear.com/9.x/notionists/svg?seed=Sophia",
  },
  {
    id: 4,
    message: "fix: update login credentials...",
    status: "Ready",
    duration: "33s",
    environment: "Production",
    repo: "tdc-matchmaker-algo-...",
    repoIcon: "▲",
    commitSha: "1db72d8",
    isRedeploy: false,
    branch: "main",
    date: "Jun 5",
    author: "https://api.dicebear.com/9.x/notionists/svg?seed=Sophia",
  },
  {
    id: 5,
    message: "Update documentation link...",
    status: "Error",
    duration: "57s",
    environment: "Production",
    repo: "mcp-x-86f9",
    repoIcon: "N",
    commitSha: "9d8f1fc",
    isRedeploy: false,
    branch: "main",
    date: "May 22",
    author: "https://api.dicebear.com/9.x/notionists/svg?seed=Alex",
  },
  {
    id: 6,
    message: "Update documentation link...",
    status: "Error",
    duration: "50s",
    environment: "Production",
    repo: "mcp-x",
    repoIcon: "N",
    commitSha: "9d8f1fc",
    isRedeploy: false,
    branch: "main",
    date: "May 22",
    author: "https://api.dicebear.com/9.x/notionists/svg?seed=Alex",
  },
];

export default function DeploymentsPage() {
  return (
    <div className="flex flex-col w-full h-full text-sm">
      
      {/* Top Header matching the screenshot */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" className="hover:bg-transparent font-medium px-0">
          <div className="w-4 h-4 border rounded-sm mr-2 flex items-center justify-center bg-muted/50" />
          All Projects
          <ChevronDown className="ml-1 size-4 text-muted-foreground" />
        </Button>
        <div className="font-medium text-sm">
          Deployments
        </div>
        <div className="w-[100px]"></div> {/* Spacer for centering */}
      </div>

      {/* Filters Bar */}
      <div className="flex items-center gap-3 mb-6 overflow-x-auto pb-2 scrollbar-none">
        <Button variant="outline" className="justify-start text-muted-foreground font-normal min-w-[200px] border-neutral-800 bg-black">
          <Calendar className="mr-2 size-4" />
          Select Date Range
        </Button>
        
        <Select defaultValue="all-authors">
          <SelectTrigger className="w-[140px] border-neutral-800 bg-black">
            <Search className="mr-2 size-3 text-muted-foreground" />
            <SelectValue placeholder="All Authors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-authors">All Authors</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="all-environments">
          <SelectTrigger className="w-[160px] border-neutral-800 bg-black">
            <SelectValue placeholder="All Environments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-environments">All Environments</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="all-repos">
          <SelectTrigger className="w-[150px] border-neutral-800 bg-black">
            <Search className="mr-2 size-3 text-muted-foreground" />
            <SelectValue placeholder="All Repositories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-repos">All Repositories</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="all-branches">
          <SelectTrigger className="w-[140px] border-neutral-800 bg-black">
            <Search className="mr-2 size-3 text-muted-foreground" />
            <SelectValue placeholder="All Branches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-branches">All Branches</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" className="border-neutral-800 bg-black">
          <div className="flex gap-1 mr-2">
            <span className="size-2 rounded-full bg-emerald-500"></span>
            <span className="size-2 rounded-full bg-red-500"></span>
            <span className="size-2 rounded-full bg-blue-500"></span>
          </div>
          Status <span className="ml-1 text-muted-foreground">6/7</span>
          <ChevronDown className="ml-2 size-4 text-muted-foreground" />
        </Button>
      </div>

      {/* Deployments List */}
      <div className="flex flex-col border border-neutral-800 rounded-lg overflow-hidden bg-black/50">
        {DUMMY_DEPLOYMENTS.map((deploy, i) => (
          <div 
            key={i} 
            className={`flex items-center p-4 hover:bg-neutral-900/50 transition-colors cursor-pointer ${
              i !== DUMMY_DEPLOYMENTS.length - 1 ? "border-b border-neutral-800" : ""
            }`}
          >
            {/* Message & Status */}
            <div className="flex items-center w-[35%] gap-4">
              <span className="truncate font-medium text-[13px]">{deploy.message}</span>
              <div className="flex items-center gap-1.5 ml-auto pr-4 shrink-0">
                <span className={`size-2 rounded-full ${deploy.status === "Ready" ? "bg-emerald-500" : "bg-red-500"}`} />
                <span className="text-muted-foreground text-[13px]">{deploy.status} <span className="opacity-70">{deploy.duration}</span></span>
              </div>
            </div>

            {/* Environment */}
            <div className="flex items-center w-[15%]">
              <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 font-normal py-0">
                <ArrowUpCircle className="mr-1 size-3" />
                {deploy.environment}
              </Badge>
            </div>

            {/* Repo */}
            <div className="flex items-center w-[20%] text-[13px] text-muted-foreground gap-2">
              <span className="font-bold text-foreground bg-neutral-800 size-5 flex items-center justify-center rounded-sm text-[10px]">
                {deploy.repoIcon}
              </span>
              <span className="truncate">{deploy.repo}</span>
            </div>

            {/* Commit & Branch */}
            <div className="flex items-center w-[20%] text-[13px] text-muted-foreground gap-3">
              {deploy.isRedeploy ? (
                <div className="flex items-center gap-1.5 truncate">
                  <span className="truncate text-foreground">Redeploy of {deploy.commitSha}</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <GitCommitHorizontal className="size-3.5" />
                    <span>{deploy.commitSha}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <GitBranch className="size-3.5" />
                    <span>{deploy.branch}</span>
                  </div>
                </>
              )}
            </div>

            {/* Date & Avatar */}
            <div className="flex items-center justify-end w-[10%] gap-3 text-[13px] text-muted-foreground shrink-0">
              <span>{deploy.date}</span>
              <Avatar className="size-6 border border-neutral-700">
                <AvatarImage src={deploy.author} />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
