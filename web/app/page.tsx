"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { TextAnimate } from "@/components/ui/text-animate";
import { NumberTicker } from "@/components/ui/number-ticker";
import { WordRotate } from "@/components/ui/word-rotate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Safari } from "@/components/ui/safari";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Zap,
  Globe,
  Shield,
  ArrowRight,
  Terminal,
  Sparkles,
  GitBranch,
  Rocket,
  Code2,
  Upload,
  ChevronDown
} from "lucide-react";
import Link from "next/link";
import Navbar from "@/components/navbar";

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState(1);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setActiveTab((prev) => (prev === 4 ? 1 : prev + 1));
    }, 3500);
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const handleTabClick = (tabIndex: number) => {
    setActiveTab(tabIndex);
    setIsAutoPlaying(false);
  };
  // Features section data is embedded directly for the bento layout.

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50 selection:bg-primary/30 relative overflow-hidden">
      {/* Background Snippet */}
      <div className="absolute top-0 z-[-2] h-screen w-screen bg-neutral-950 bg-[radial-gradient(100%_50%_at_50%_0%,rgba(139,157,206,0.15)_0,rgba(139,157,206,0)_50%,rgba(139,157,206,0)_100%)]"></div>
      
      <Navbar />

      {/* Hero Section */}
      <section id="hero" className="relative w-full relative pt-16 md:pt-24 pb-8 md:pb-10">
        <div className="mx-auto w-full max-w-[1080px] px-4">
          
          {/* Badge */}
          <div className="flex justify-center mb-7 md:mb-10">
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 rounded-full pl-2 pr-4 py-1.5 flex-col md:flex-row text-center bg-neutral-900/40 border border-neutral-800/80 text-[12px] md:text-[13px] font-medium text-neutral-200 shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:border-neutral-700/70 transition-colors backdrop-blur-xl"
            >
              <span className="inline-flex items-center gap-1 rounded-full bg-[#1c2333] ring-1 ring-[#2a3449] px-2 py-0.5 text-[10.5px] uppercase tracking-[0.14em] text-[#8b9dce]">
                <Sparkles size={12} className="mr-1" /> NEW
              </span>
              Create serverless edge deployments with Kyte
            </Link>
          </div>
          
          {/* Title */}
          <h1 className="font-sans font-medium text-white text-balance text-[2.5rem] leading-[1.04] tracking-[-0.022em] sm:text-[3rem] md:text-[3.5rem] lg:text-[3.75rem] md:leading-[1.02] md:tracking-[-0.025em] text-center mx-auto max-w-[32ch]">
            Deploy Next.js, React and Vue, <em className="italic text-[#8b9dce]">instantly</em>.
          </h1>
          
          {/* Subtitle */}
          <p className="font-sans font-normal text-[16px] md:text-[17px] leading-[1.6] text-neutral-400 text-balance mt-5 md:mt-6 max-w-[560px] mx-auto text-center">
            High-performance automated deployment platform for modern frontend teams — push your code and get a live URL instantly without configuring complex CI/CD pipelines.
          </p>

          {/* CTA */}
          <div className="mt-8 md:mt-10 flex flex-col items-center gap-4">
            <Button className="inline-flex items-center justify-center gap-1 whitespace-nowrap text-sm transition-colors cursor-pointer duration-80 relative active:scale-[0.99] bg-white text-black hover:bg-neutral-200 font-medium shadow-[0_0px_1px_rgba(0,0,0,0.45),0_2px_3px_rgba(0,0,0,0.05),0_0px_1px_rgba(0,0,0,0.07)] h-11 rounded-lg px-8 w-auto border-0">
              Start deploying for free <ArrowRight className="size-4" />
            </Button>
            <p className="font-sans font-normal text-[13px] text-neutral-500 text-center">
              Unlimited Previews · No Credit Card · 2-Minute Setup
            </p>
          </div>

          {/* Dashboard Preview Tabs */}
          <div className="mt-12 md:mt-20 relative mx-auto w-full max-w-[1080px]">
            <div className="flex justify-center mb-4 md:mb-5">
              <div className="relative max-w-full">
                <div className="inline-flex items-center gap-0.5 md:gap-2 max-w-full overflow-x-auto scrollbar-hide" role="tablist">
                  <button onClick={() => handleTabClick(1)} type="button" className={`relative px-3 md:px-4 py-2 text-[13px] md:text-[14px] font-medium transition-colors whitespace-nowrap cursor-pointer ${activeTab === 1 ? 'text-white' : 'text-neutral-500 hover:text-neutral-200'}`}>
                    <span className={`hidden sm:inline font-mono text-[11px] tracking-[0.08em] mr-1.5 transition-colors ${activeTab === 1 ? 'text-[#8b9dce]' : 'text-neutral-600'}`}>01</span>
                    <span className="sm:hidden">Connect</span>
                    <span className="hidden sm:inline">Connect GitHub</span>
                    {activeTab === 1 && <span className="absolute left-2 right-2 md:left-3 md:right-3 bottom-0 h-[2px] bg-[#8b9dce] origin-left z-10"></span>}
                  </button>
                  <button onClick={() => handleTabClick(2)} type="button" className={`relative px-3 md:px-4 py-2 text-[13px] md:text-[14px] font-medium transition-colors whitespace-nowrap cursor-pointer ${activeTab === 2 ? 'text-white' : 'text-neutral-500 hover:text-neutral-200'}`}>
                    <span className={`hidden sm:inline font-mono text-[11px] tracking-[0.08em] mr-1.5 transition-colors ${activeTab === 2 ? 'text-[#8b9dce]' : 'text-neutral-600'}`}>02</span>
                    <span className="sm:hidden">Build</span>
                    <span className="hidden sm:inline">Build Automatically</span>
                    {activeTab === 2 && <span className="absolute left-2 right-2 md:left-3 md:right-3 bottom-0 h-[2px] bg-[#8b9dce] origin-left z-10"></span>}
                  </button>
                  <button onClick={() => handleTabClick(3)} type="button" className={`relative px-3 md:px-4 py-2 text-[13px] md:text-[14px] font-medium transition-colors whitespace-nowrap cursor-pointer ${activeTab === 3 ? 'text-white' : 'text-neutral-500 hover:text-neutral-200'}`}>
                    <span className={`hidden sm:inline font-mono text-[11px] tracking-[0.08em] mr-1.5 transition-colors ${activeTab === 3 ? 'text-[#8b9dce]' : 'text-neutral-600'}`}>03</span>
                    <span className="sm:hidden">Deploy</span>
                    <span className="hidden sm:inline">Deploy on Edge</span>
                    {activeTab === 3 && <span className="absolute left-2 right-2 md:left-3 md:right-3 bottom-0 h-[2px] bg-[#8b9dce] origin-left z-10"></span>}
                  </button>
                  <button onClick={() => handleTabClick(4)} type="button" className={`relative px-3 md:px-4 py-2 text-[13px] md:text-[14px] font-medium transition-colors whitespace-nowrap cursor-pointer ${activeTab === 4 ? 'text-white' : 'text-neutral-500 hover:text-neutral-200'}`}>
                    <span className={`hidden sm:inline font-mono text-[11px] tracking-[0.08em] mr-1.5 transition-colors ${activeTab === 4 ? 'text-[#8b9dce]' : 'text-neutral-600'}`}>04</span>
                    <span className="sm:hidden">Share</span>
                    <span className="hidden sm:inline">Share Preview</span>
                    {activeTab === 4 && <span className="absolute left-2 right-2 md:left-3 md:right-3 bottom-0 h-[2px] bg-[#8b9dce] origin-left z-10"></span>}
                  </button>
                </div>
                <span className="absolute inset-x-0 bottom-0 h-px bg-neutral-800/70"></span>
              </div>
            </div>
          </div>
          
          {/* Dashboard Preview */}
          <div className="relative mx-auto mt-0 w-full max-w-[1200px] px-4 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-500" role="tabpanel" id="hero-preview-panel">
            {/* Subtle Slate-blue glow behind the tab view */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100%] h-[100%] bg-[#8b9dce]/10 blur-[140px] rounded-[100%] pointer-events-none z-[-1]"></div>
            
            <div aria-hidden="true" className="absolute inset-x-16 -bottom-4 h-12 bg-neutral-950/10 dark:bg-black/60 blur-3xl rounded-full"></div>
            <div className="relative z-10 rounded-2xl overflow-hidden border border-neutral-800 bg-[#0a0a0a] shadow-[0_1px_2px_rgba(16,24,40,0.04),0_40px_80px_-30px_rgba(16,24,40,0.18)] dark:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)]">
              <div className="relative bg-[#0a0a0a] h-[500px] sm:h-[600px] lg:h-[700px] flex flex-col font-sans">
                {/* Mac Window Header */}
                <div className="flex items-center gap-2 border-b border-neutral-800/80 bg-neutral-900/40 px-4 py-2.5 h-10 shrink-0">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-neutral-700/80 hover:bg-red-500 transition-colors"></div>
                    <div className="h-3 w-3 rounded-full bg-neutral-700/80 hover:bg-yellow-500 transition-colors"></div>
                    <div className="h-3 w-3 rounded-full bg-neutral-700/80 hover:bg-green-500 transition-colors"></div>
                  </div>
                  <div className="flex-1 text-center text-[11px] font-medium text-neutral-500 font-mono tracking-wide">
                    {activeTab === 1 && "github-integration"}
                    {activeTab === 2 && "build-pipeline"}
                    {activeTab === 3 && "kyte-dashboard"}
                    {activeTab === 4 && "preview-environment"}
                  </div>
                </div>

                {/* Content Area - Full App Desktop View */}
                <div className="flex-1 overflow-hidden relative flex">
                  
                  {/* Fake Sidebar */}
                  <div className="hidden md:flex w-[220px] flex-col border-r border-neutral-800/60 bg-neutral-900/30 p-4 gap-2">
                    <div className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider mb-2 px-2">Project</div>
                    <div className={`text-xs px-3 py-2 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 1 ? 'bg-neutral-800 text-white' : 'text-neutral-400'}`}>
                      <Code2 className="size-4" /> Connect Repository
                    </div>
                    <div className={`text-xs px-3 py-2 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 2 ? 'bg-neutral-800 text-white' : 'text-neutral-400'}`}>
                      <Terminal className="size-4" /> Deployments
                    </div>
                    <div className={`text-xs px-3 py-2 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 3 ? 'bg-neutral-800 text-white' : 'text-neutral-400'}`}>
                      <Zap className="size-4" /> Edge Metrics
                    </div>
                    <div className={`text-xs px-3 py-2 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 4 ? 'bg-neutral-800 text-white' : 'text-neutral-400'}`}>
                      <Globe className="size-4" /> Domains & URLs
                    </div>
                    
                    <div className="mt-auto border-t border-neutral-800/60 pt-4">
                      <div className="text-xs px-2 py-1.5 text-neutral-400 flex items-center gap-2.5 hover:bg-neutral-800/50 rounded-lg cursor-pointer transition-colors group">
                        <div className="w-6 h-6 rounded-full bg-neutral-200 border border-neutral-700 group-hover:border-[#8b9dce] transition-colors overflow-hidden flex items-center justify-center shrink-0">
                          <img src="https://api.dicebear.com/9.x/notionists/svg?seed=Sophia&backgroundColor=transparent" alt="Avatar" className="w-full h-full object-cover p-[1px]" />
                        </div>
                        <span className="font-medium text-neutral-300">Alex's Team</span>
                        <ChevronDown className="size-3.5 text-neutral-600 ml-auto" />
                      </div>
                    </div>
                  </div>

                  {/* Main Panel */}
                  <div className="flex-1 flex flex-col bg-neutral-950/30">
                    
                    {/* Topbar / Breadcrumbs */}
                    <div className="h-12 border-b border-neutral-800/60 flex items-center px-6 gap-2 text-[13px] text-neutral-400">
                      <span className="text-neutral-500 hover:text-neutral-300 cursor-pointer transition-colors">Kyte</span> 
                      <span className="text-neutral-600">/</span> 
                      <span className="text-white flex items-center gap-2 font-medium">
                        <div className="w-5 h-5 rounded bg-white text-black flex items-center justify-center text-[10px] font-bold">O</div>
                        Overlord
                      </span>
                      <Badge variant="outline" className="ml-2 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] px-2 py-0 h-5">Production</Badge>
                    </div>
                    
                    {/* Dynamic Step Content */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col">
                      {activeTab === 1 && (
                        <div className="w-full max-w-3xl mx-auto animate-in fade-in zoom-in-95 duration-300 h-full flex flex-col pt-4">
                          <div className="mb-6 flex items-end justify-between border-b border-neutral-800 pb-4">
                            <div>
                              <h2 className="text-xl font-medium text-white mb-1.5">Import Git Repository</h2>
                              <p className="text-[13px] text-neutral-400">Select a repository from your GitHub account to deploy to Kyte.</p>
                            </div>
                            <div className="hidden sm:flex items-center gap-2">
                              <div className="px-3 py-1.5 text-xs text-neutral-400 bg-neutral-900/50 border border-neutral-800 rounded-md">Search repositories...</div>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="p-4 rounded-xl border border-neutral-700 bg-neutral-800/20 flex items-center gap-4 transition-colors">
                              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shrink-0">
                                <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33c.85 0 1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2Z"/></svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-sm font-medium text-white truncate">Kyte / Overlord</h3>
                                  <Badge variant="outline" className="text-[10px] h-4 py-0 px-1.5 bg-neutral-900 border-neutral-700 text-neutral-400 shrink-0">Private</Badge>
                                </div>
                                <p className="text-[12px] text-neutral-500 truncate">Next.js application • Updated 2 mins ago</p>
                              </div>
                              <Button className="h-8 text-[12px] bg-white text-black hover:bg-neutral-200 rounded-md px-5 shrink-0 font-medium">Import</Button>
                            </div>
                            
                            {[1, 2, 3].map((item) => (
                              <div key={item} className="p-4 rounded-xl border border-neutral-800/80 bg-neutral-900/10 flex items-center gap-4 hover:bg-neutral-900/30 transition-colors">
                                <div className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center text-[10px] text-neutral-500 font-mono shrink-0">git</div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-sm font-medium text-neutral-300 truncate mb-1">Kyte / {item === 1 ? 'Analytics' : item === 2 ? 'Docs' : 'Design-System'}</h3>
                                  <p className="text-[12px] text-neutral-600 truncate">Updated {item * 3} days ago</p>
                                </div>
                                <Button variant="outline" className="h-8 text-[12px] bg-transparent border-neutral-800 text-neutral-400 rounded-md px-5 hover:bg-neutral-800 hover:text-neutral-300 shrink-0">Import</Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {activeTab === 2 && (
                        <div className="w-full max-w-4xl mx-auto h-full flex gap-4 animate-in fade-in zoom-in-95 duration-300">
                          <div className="flex-1 rounded-xl border border-neutral-800 bg-[#050505] overflow-hidden flex flex-col shadow-2xl">
                            <div className="border-b border-neutral-800 px-4 py-3 flex items-center justify-between bg-neutral-900/40">
                              <div className="flex items-center gap-2.5">
                                <div className="w-2 h-2 rounded-full bg-neutral-400 animate-pulse"></div>
                                <span className="text-[13px] text-neutral-300 font-medium tracking-wide">Building Deployment</span>
                              </div>
                              <span className="text-[11px] text-neutral-500 font-mono">00:12s</span>
                            </div>
                            <div className="flex-1 p-5 font-mono text-[13px] text-neutral-500 overflow-y-auto space-y-1.5">
                              <div><span className="text-neutral-600">[14:02:11]</span> Cloning repository Kyte/Overlord...</div>
                              <div><span className="text-neutral-600">[14:02:12]</span> Running build command 'npm run build'...</div>
                              <div><span className="text-neutral-600">[14:02:15]</span> Installing dependencies (npm install)...</div>
                              <div className="text-neutral-400">✓ Dependencies installed successfully (2.1s)</div>
                              <div className="mt-3"><span className="text-neutral-600">[14:02:18]</span> Building Next.js application (Turbopack)...</div>
                              <div className="pl-4">Creating an optimized production build...</div>
                              <div className="pl-4">✓ Compiled successfully</div>
                              <div className="pl-4">✓ Collecting page data</div>
                              <div className="pl-4">✓ Generating static pages (142/142)</div>
                              <div className="text-neutral-400 mt-3">✓ Build completed successfully in 12.4s</div>
                              <div className="mt-2 text-neutral-300 animate-pulse">Assigning to global edge regions...</div>
                            </div>
                          </div>
                          <div className="hidden lg:flex w-64 flex-col gap-4">
                            <div className="rounded-xl border border-neutral-800 bg-neutral-900/20 p-4">
                              <div className="text-[11px] uppercase font-semibold text-neutral-500 mb-3">Deployment Info</div>
                              <div className="space-y-3 text-[12px]">
                                <div className="flex justify-between"><span className="text-neutral-500">Branch</span><span className="text-neutral-300 font-mono">main</span></div>
                                <div className="flex justify-between"><span className="text-neutral-500">Commit</span><span className="text-neutral-300 font-mono">a7f93b2</span></div>
                                <div className="flex justify-between"><span className="text-neutral-500">Framework</span><span className="text-neutral-300">Next.js</span></div>
                                <div className="flex justify-between"><span className="text-neutral-500">Region</span><span className="text-neutral-300">Global Edge</span></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === 3 && (
                        <div className="w-full h-full flex flex-col animate-in fade-in zoom-in-95 duration-300 max-w-5xl mx-auto">
                           <div className="mb-6 flex justify-between items-end border-b border-neutral-800 pb-4">
                            <div>
                              <h2 className="text-xl font-medium text-white mb-1">Project Overview</h2>
                              <p className="text-[13px] text-neutral-400">my-app.kyte.dev is currently active and receiving traffic.</p>
                            </div>
                            <Button className="h-8 text-[12px] bg-white text-black hover:bg-neutral-200 rounded-md px-4">Visit URL <ArrowRight className="size-3 ml-1.5" /></Button>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/20 flex flex-col">
                              <p className="text-[11px] text-neutral-500 uppercase font-medium mb-1">Status</p>
                              <div className="flex items-center gap-2 mt-auto">
                                <div className="w-2 h-2 rounded-full bg-neutral-400"></div>
                                <span className="text-lg font-medium text-white">Healthy</span>
                              </div>
                            </div>
                            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/20 flex flex-col">
                              <p className="text-[11px] text-neutral-500 uppercase font-medium mb-1">Edge Cache Hit</p>
                              <div className="mt-auto flex items-baseline gap-1.5">
                                <h4 className="text-2xl font-medium text-white">99.9%</h4>
                              </div>
                            </div>
                            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/20 flex flex-col">
                              <p className="text-[11px] text-neutral-500 uppercase font-medium mb-1">Total Bandwidth</p>
                              <div className="mt-auto flex items-baseline gap-1.5">
                                <h4 className="text-2xl font-medium text-white">42.8 <span className="text-sm font-normal text-neutral-500">GB</span></h4>
                              </div>
                            </div>
                            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/20 flex flex-col">
                              <p className="text-[11px] text-neutral-500 uppercase font-medium mb-1">Avg Latency</p>
                              <div className="mt-auto flex items-baseline gap-1.5">
                                <h4 className="text-2xl font-medium text-white">24 <span className="text-sm font-normal text-neutral-500">ms</span></h4>
                              </div>
                            </div>
                          </div>

                          <div className="flex-1 rounded-xl border border-neutral-800 bg-[#070707] p-5 overflow-hidden flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                              <p className="text-[12px] text-white font-medium">Production Deployments</p>
                              <span className="text-[11px] text-neutral-500">Last 7 days</span>
                            </div>
                            <div className="space-y-3 flex-1 overflow-y-auto pr-2">
                              {[1,2,3,4].map((i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-neutral-900/30 border border-neutral-800/40">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-1.5 h-1.5 rounded-full ${i === 1 ? 'bg-white' : 'bg-neutral-600'}`}></div>
                                    <div>
                                      <div className="text-[13px] text-neutral-200 font-medium mb-0.5">Update hero styling #{80 + i}</div>
                                      <div className="text-[11px] text-neutral-500 font-mono">main • {i * 2}h ago by Alex</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-[11px] text-neutral-500 hidden sm:block">14.2s</span>
                                    <Badge variant="outline" className={`text-[10px] h-5 ${i === 1 ? 'border-neutral-500 text-neutral-300' : 'border-neutral-800 text-neutral-500'}`}>{i === 1 ? 'Current' : 'Reverted'}</Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === 4 && (
                        <div className="w-full max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-300 h-full flex flex-col items-center justify-center">
                          <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(255,255,255,0.1)]">
                              <Globe className="w-8 h-8 text-black" />
                            </div>
                            <h3 className="text-2xl font-medium text-white mb-2">Ready to Share</h3>
                            <p className="text-sm text-neutral-400 max-w-sm mx-auto">Your preview environment is active. Share this link with your team for feedback.</p>
                          </div>
                          
                          <div className="w-full max-w-xl">
                            <div className="p-1.5 rounded-xl border border-neutral-800 bg-neutral-900/50 flex items-center gap-2 mb-8 shadow-2xl backdrop-blur-sm">
                              <div className="flex-1 px-4 text-[13px] font-mono text-neutral-300 text-left truncate flex items-center gap-2">
                                <span className="text-neutral-500">https://</span>overlord-preview-v2.kyte.dev
                              </div>
                              <Button className="h-9 rounded-lg bg-white text-black hover:bg-neutral-200 px-6 text-[13px] font-medium transition-transform active:scale-95">
                                Copy Link
                              </Button>
                            </div>
                            
                            {/* Fake Website Wireframe */}
                            <div className="w-full aspect-[2/1] rounded-xl border border-neutral-800 bg-[#050505] p-4 flex flex-col shadow-2xl">
                              <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
                                <div className="w-20 h-4 bg-neutral-800 rounded"></div>
                                <div className="flex gap-2">
                                  <div className="w-10 h-4 bg-neutral-800 rounded"></div>
                                  <div className="w-10 h-4 bg-neutral-800 rounded"></div>
                                </div>
                              </div>
                              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                                <div className="w-48 h-6 bg-neutral-800 rounded-md"></div>
                                <div className="w-72 h-3 bg-neutral-800/50 rounded"></div>
                                <div className="w-64 h-3 bg-neutral-800/50 rounded"></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Floating Badges */}
            <div aria-hidden="true" className="absolute inset-0 pointer-events-none hidden lg:block z-10">
              {/* Top Left */}
              <div className={`absolute left-[-8%] top-[15%] transition-all duration-700 ease-out ${activeTab === 1 || activeTab === 2 ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}>
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-600 pl-1.5 py-1.5 shadow-lg pr-3.5">
                  <span className="grid size-6 place-items-center rounded-full bg-white/20 text-white">
                    <Rocket className="size-3.5" />
                  </span>
                  <span className="font-sans font-medium text-white whitespace-nowrap text-[12.5px]">Global Edge Network</span>
                </div>
              </div>

              {/* Top Right */}
              <div className={`absolute right-[-8%] top-[25%] transition-all duration-700 ease-out delay-100 ${activeTab === 3 || activeTab === 4 ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-600 pl-1.5 py-1.5 shadow-lg pr-3.5">
                  <span className="grid size-6 place-items-center rounded-full bg-white/20 text-white">
                    <Zap className="size-3.5" />
                  </span>
                  <span className="font-sans font-medium text-white whitespace-nowrap text-[12.5px]">Instant Rollbacks</span>
                </div>
              </div>

              {/* Middle Left */}
              <div className={`absolute left-[-10%] top-[50%] transition-all duration-700 ease-out delay-200 ${activeTab === 3 ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}>
                <div className="inline-flex items-center gap-2 rounded-full bg-indigo-600 pl-1.5 py-1.5 shadow-lg pr-3.5">
                  <span className="grid size-6 place-items-center rounded-full bg-white/20 text-white">
                    <Globe className="size-3.5" />
                  </span>
                  <span className="font-sans font-medium text-white whitespace-nowrap text-[12.5px]">Custom Domains</span>
                </div>
              </div>

              {/* Middle Right */}
              <div className={`absolute right-[-10%] top-[60%] transition-all duration-700 ease-out delay-300 ${activeTab === 4 || activeTab === 1 ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}>
                <div className="inline-flex items-center gap-2 rounded-full bg-purple-600 pl-1.5 py-1.5 shadow-lg pr-3.5">
                  <span className="grid size-6 place-items-center rounded-full bg-white/20 text-white">
                    <GitBranch className="size-3.5" />
                  </span>
                  <span className="font-sans font-medium text-white whitespace-nowrap text-[12.5px]">Preview Deployments</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="relative px-4 py-24 sm:py-32">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#8b9dce]/5 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="mx-auto max-w-7xl relative z-10">
          <div className="flex flex-col items-center text-center gap-4 mb-16 md:mb-24">
            <p className="text-sm font-semibold tracking-widest text-[#8b9dce] uppercase mb-4">
              WORKFLOW
            </p>
            <h2 className="text-3xl sm:text-5xl font-medium tracking-tight text-white mb-2 max-w-2xl mt-2">
              From <span className="italic text-[#8b9dce]">commit</span> to <span className="italic text-white">production</span> in seconds.
            </h2>
            <p className="max-w-xl text-[16px] md:text-[17px] leading-relaxed text-neutral-400 mt-2">
              Stop configuring complex CI/CD pipelines. Kyte handles the heavy lifting so you can focus on building.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 relative">
            {/* Step 1 */}
            <div className="group relative border-b lg:border-b-0 lg:border-r border-neutral-800/80 transition-all duration-500 hover:bg-[#0a0a0a]/50 flex flex-col">
              {/* Visual Header */}
              <div className="h-56 relative overflow-hidden flex items-center justify-center">
                
                {/* Minimalist GitHub to Kyte connection */}
                <div className="flex items-center gap-3 z-10 relative">
                  <div className="size-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center shadow-2xl z-10 transform group-hover:-translate-x-2 transition-transform duration-500">
                    <GitBranch className="size-6 text-neutral-400" />
                  </div>
                  <div className="h-px w-16 bg-neutral-800 relative overflow-hidden">
                     <div className="absolute top-0 left-0 h-full w-full bg-[#8b9dce] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-700 delay-100"></div>
                  </div>
                  <div className="size-14 rounded-2xl bg-[#8b9dce]/10 border border-[#8b9dce]/30 flex items-center justify-center shadow-[0_0_25px_rgba(139,157,206,0.15)] relative overflow-hidden z-10 transform group-hover:translate-x-2 transition-transform duration-500">
                    <div className="absolute inset-0 bg-[#8b9dce] opacity-0 group-hover:opacity-10 transition-opacity duration-500 delay-300"></div>
                    <Terminal className="size-6 text-[#8b9dce]" />
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-8 relative z-10 bg-transparent flex-1 pt-0">
                <div className="mb-5 inline-flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-[#8b9dce] bg-[#8b9dce]/10 px-2.5 py-1 rounded-md">STEP 01</span>
                </div>
                <h3 className="mb-3 text-xl font-medium text-neutral-200">Connect Codebase</h3>
                <p className="text-[14px] text-neutral-400 leading-relaxed">
                  Import your repository from GitHub or GitLab. We automatically detect your framework and configure the optimal build settings without any manual setup.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="group relative border-b lg:border-b-0 lg:border-r border-neutral-800/80 transition-all duration-500 hover:bg-[#0a0a0a]/50 flex flex-col">
              {/* Visual Header */}
              <div className="h-56 relative overflow-hidden flex items-center justify-center">
                
                {/* Minimalist Terminal build */}
                <div className="w-[85%] max-w-[260px] rounded-xl bg-neutral-950 border border-neutral-800 shadow-2xl overflow-hidden z-10 transform group-hover:-translate-y-2 transition-transform duration-500">
                  <div className="px-3 py-2.5 border-b border-neutral-900 flex items-center gap-1.5 bg-[#050505]">
                    <div className="size-2 rounded-full bg-neutral-700"></div>
                    <div className="size-2 rounded-full bg-neutral-700"></div>
                    <div className="size-2 rounded-full bg-neutral-700"></div>
                  </div>
                  <div className="p-4 font-mono text-[11px] space-y-2">
                    <div className="text-neutral-500 flex items-center gap-2"><span className="text-[#8b9dce]">~</span> npm run build</div>
                    <div className="text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">Building optimized bundle...</div>
                    <div className="text-emerald-400/90 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-300">✓ Compiled successfully</div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-8 relative z-10 bg-transparent flex-1 pt-0">
                <div className="mb-5 inline-flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-[#8b9dce] bg-[#8b9dce]/10 px-2.5 py-1 rounded-md">STEP 02</span>
                </div>
                <h3 className="mb-3 text-xl font-medium text-neutral-200">Secure Build</h3>
                <p className="text-[14px] text-neutral-400 leading-relaxed">
                  Your app is securely compiled in our isolated containers. We install dependencies, cache assets, and optimize your production build for maximum performance.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="group relative transition-all duration-500 hover:bg-[#0a0a0a]/50 flex flex-col">
              {/* Visual Header */}
              <div className="h-56 relative overflow-hidden flex items-center justify-center">
                
                {/* Minimalist Globe / Nodes */}
                <div className="relative z-10 w-full h-full flex items-center justify-center">
                  {/* Glowing Node Group */}
                  <div className="relative transform group-hover:scale-110 transition-transform duration-700">
                    <Globe className="size-10 text-neutral-600 group-hover:text-[#8b9dce] transition-colors duration-500 relative z-10" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-16 bg-[#8b9dce]/0 group-hover:bg-[#8b9dce]/20 blur-xl rounded-full transition-colors duration-500"></div>
                    
                    {/* Floating mini nodes */}
                    <div className="absolute -top-6 -right-8 size-2.5 bg-[#8b9dce] rounded-full shadow-[0_0_12px_#8b9dce] opacity-0 group-hover:opacity-100 transition-all duration-500 delay-100 translate-y-3 group-hover:translate-y-0"></div>
                    <div className="absolute -bottom-4 -left-10 size-1.5 bg-[#8b9dce] rounded-full shadow-[0_0_8px_#8b9dce] opacity-0 group-hover:opacity-70 transition-all duration-500 delay-200 -translate-y-3 group-hover:translate-y-0"></div>
                    <div className="absolute top-8 -right-12 size-1.5 bg-[#8b9dce] rounded-full shadow-[0_0_8px_#8b9dce] opacity-0 group-hover:opacity-90 transition-all duration-500 delay-300 translate-x-3 group-hover:translate-x-0"></div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-8 relative z-10 bg-transparent flex-1 pt-0">
                <div className="mb-5 inline-flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-[#8b9dce] bg-[#8b9dce]/10 px-2.5 py-1 rounded-md">STEP 03</span>
                </div>
                <h3 className="mb-3 text-xl font-medium text-neutral-200">Global Deploy</h3>
                <p className="text-[14px] text-neutral-400 leading-relaxed">
                  Your static assets are distributed instantly across our global edge network. Deliver your application to users worldwide with milliseconds of latency.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative px-4 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold tracking-widest text-[#8b9dce] uppercase mb-4">
              FEATURES
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl text-foreground mb-6">
              Empower Your Deployment Workflows
            </h2>
            <p className="max-w-2xl mx-auto text-lg text-neutral-400">
              Generic deployment tools won't suffice. Our platform is purpose-built to provide exceptional edge performance for your unique applications.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 relative max-w-6xl mx-auto border-y border-neutral-800/80 mt-12">
            {/* Top Left Card */}
            <div className="col-span-1 border-b md:border-r border-neutral-800/80 flex flex-col overflow-hidden h-[380px] group transition-colors hover:bg-[#0a0a0a]/50 relative">
              <div className="p-8 pb-4">
                <h3 className="text-xl font-medium text-neutral-200 mb-2">Advanced Edge Routing</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  Our platform utilizes cutting-edge CDN nodes to provide accurate and efficient delivery for your business needs.
                </p>
              </div>
              <div className="flex-1 relative mt-4 mx-8 mb-0 rounded-t-xl border-x border-t border-neutral-800/50 bg-[#050505] overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,157,206,0.1)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                <div className="p-3 border-b border-neutral-800/50 flex items-center gap-2 bg-[#050505]">
                  <div className="flex gap-1.5"><div className="w-2 h-2 rounded-full bg-neutral-700"/><div className="w-2 h-2 rounded-full bg-neutral-700"/><div className="w-2 h-2 rounded-full bg-neutral-700"/></div>
                  <div className="text-xs text-neutral-500 ml-2 font-mono flex items-center gap-1"><Terminal size={12}/> deploy.log</div>
                </div>
                <div className="p-4 space-y-2 font-mono text-xs text-neutral-400 bg-transparent">
                  <p><span className="text-[#8b9dce]">~</span> Building optimized production build...</p>
                  <p><span className="text-[#8b9dce]">~</span> Deploying to 32 edge nodes</p>
                  <p className="text-emerald-400/90">✓ fra1 (Frankfurt) - 12ms</p>
                  <p className="text-emerald-400/90">✓ iad1 (Washington) - 15ms</p>
                  <p className="text-emerald-400/90">✓ hnd1 (Tokyo) - 18ms</p>
                  <p className="text-emerald-400/90">✓ lhr1 (London) - 11ms</p>
                </div>
              </div>
            </div>

            {/* Top Middle Card */}
            <div className="col-span-1 border-b md:border-r border-neutral-800/80 flex flex-col overflow-hidden h-[380px] group transition-colors hover:bg-[#0a0a0a]/50 relative">
              <div className="p-8 pb-4">
                <h3 className="text-xl font-medium text-neutral-200 mb-2">Secure By Default</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  State-of-the-art encryption and strict privacy protocols, ensuring your source code remains completely confidential.
                </p>
              </div>
              <div className="flex-1 relative mt-4 mx-8 mb-0 rounded-t-xl border-x border-t border-neutral-800/50 bg-[#050505] overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,157,206,0.1)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                <div className="p-3 border-b border-neutral-800/50 flex items-center gap-2 bg-[#050505]">
                  <div className="flex gap-1.5"><div className="w-2 h-2 rounded-full bg-neutral-700"/><div className="w-2 h-2 rounded-full bg-neutral-700"/><div className="w-2 h-2 rounded-full bg-neutral-700"/></div>
                  <div className="text-xs text-neutral-500 ml-2 font-mono flex items-center gap-1"><Shield size={12}/> Security</div>
                </div>
                <div className="p-4 flex flex-col gap-2 font-mono text-[10px] text-neutral-400 uppercase tracking-widest bg-transparent">
                  <div className="flex justify-between items-center bg-[#0a0a0a] p-2.5 rounded border border-neutral-800/50">
                    <span className="flex items-center gap-2"><Globe size={14} className="text-neutral-500" /> SSL Cert</span>
                    <span className="text-[#8b9dce] bg-[#8b9dce]/10 px-1.5 py-0.5 rounded">Active</span>
                  </div>
                  <div className="flex justify-between items-center bg-[#0a0a0a] p-2.5 rounded border border-neutral-800/50">
                    <span className="flex items-center gap-2"><Shield size={14} className="text-neutral-500" /> DDoS</span>
                    <span className="text-[#8b9dce] bg-[#8b9dce]/10 px-1.5 py-0.5 rounded">Enabled</span>
                  </div>
                  <div className="flex justify-between items-center bg-[#0a0a0a] p-2.5 rounded border border-neutral-800/50">
                    <span className="flex items-center gap-2"><Terminal size={14} className="text-neutral-500" /> VM Type</span>
                    <span className="text-[#8b9dce] bg-[#8b9dce]/10 px-1.5 py-0.5 rounded">Isolated</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Card (Spans 2 rows) */}
            <div className="col-span-1 md:row-span-2 border-b md:border-b-0 flex flex-col overflow-hidden md:h-full h-[400px] group transition-colors hover:bg-[#0a0a0a]/50 relative">
              <div className="p-8 pb-4">
                <h3 className="text-xl font-medium text-neutral-200 mb-2">Seamless Integration</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  Easily integrate our deployment solutions into your existing workflows and systems for a smooth and efficient operation.
                </p>
              </div>
              <div className="flex-1 relative mt-4 mx-8 mb-0 rounded-t-xl border-x border-t border-neutral-800/50 bg-[#050505] overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,157,206,0.1)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                <div className="p-3 border-b border-neutral-800/50 flex items-center gap-2 bg-[#050505]">
                  <div className="flex gap-1.5"><div className="w-2 h-2 rounded-full bg-neutral-700"/><div className="w-2 h-2 rounded-full bg-neutral-700"/><div className="w-2 h-2 rounded-full bg-neutral-700"/></div>
                </div>
                <div className="flex h-full bg-transparent">
                   <div className="w-1/3 border-r border-neutral-800/50 p-2 py-3 flex flex-col gap-1 font-medium text-[11px] text-neutral-400">
                      <div className="flex items-center gap-2 text-[#8b9dce] bg-[#8b9dce]/10 p-1.5 rounded"><GitBranch size={12}/> GitHub</div>
                      <div className="flex items-center gap-2 p-1.5 hover:bg-neutral-900 rounded"><GitBranch size={12}/> GitLab</div>
                      <div className="flex items-center gap-2 p-1.5 hover:bg-neutral-900 rounded"><Globe size={12}/> Domains</div>
                      <div className="flex items-center gap-2 p-1.5 hover:bg-neutral-900 rounded"><Terminal size={12}/> CLI</div>
                   </div>
                   <div className="w-2/3 p-4 font-mono text-[11px] text-neutral-500">
                     <p className="text-neutral-300 mb-3 font-sans font-medium text-xs">Automated PR Comments</p>
                     <div className="bg-[#0a0a0a] p-3 rounded-md border border-neutral-800/50">
                       <p className="text-neutral-300"><span className="font-semibold text-[#8b9dce]">Kyte</span> <span className="text-neutral-500 font-sans">bot</span></p>
                       <p className="mt-2 text-neutral-400">Preview Environment Ready!</p>
                       <p className="text-[#8b9dce] mt-2 hover:underline bg-[#8b9dce]/10 px-2 py-1 rounded inline-block truncate w-full">pr-142.kyte.dev</p>
                     </div>
                   </div>
                </div>
              </div>
            </div>

            {/* Bottom Left Card (Spans 2 cols) */}
            <div className="col-span-1 md:col-span-2 md:border-r border-neutral-800/80 flex flex-col overflow-hidden h-[380px] group transition-colors hover:bg-[#0a0a0a]/50 relative">
              <div className="p-8 pb-4 md:w-2/3">
                <h3 className="text-xl font-medium text-neutral-200 mb-2">Customizable Workflows</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  Tailor our CI/CD services to your specific needs with flexible customization options, allowing you to get the most out of our platform.
                </p>
              </div>
              <div className="flex-1 relative mt-4 mx-8 mb-0 rounded-t-xl border-x border-t border-neutral-800/50 bg-[#050505] overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,157,206,0.1)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                <div className="p-3 border-b border-neutral-800/50 flex items-center gap-2 bg-[#050505]">
                  <div className="flex gap-1.5"><div className="w-2 h-2 rounded-full bg-neutral-700"/><div className="w-2 h-2 rounded-full bg-neutral-700"/><div className="w-2 h-2 rounded-full bg-neutral-700"/></div>
                  <div className="text-xs text-neutral-500 ml-2 font-mono flex items-center gap-1"><Code2 size={12}/> Settings</div>
                </div>
                <div className="p-4 flex gap-6 h-full bg-transparent">
                  <div className="w-48 hidden md:block border-r border-neutral-800/50 pr-6">
                    <div className="flex flex-col gap-2 text-xs font-medium text-neutral-500">
                      <span className="text-[#8b9dce] bg-[#8b9dce]/10 px-2 py-1.5 rounded">Build Settings</span>
                      <span className="px-2 py-1.5 hover:text-neutral-300 cursor-pointer">Environment Variables</span>
                      <span className="px-2 py-1.5 hover:text-neutral-300 cursor-pointer">Custom Domains</span>
                      <span className="px-2 py-1.5 hover:text-neutral-300 cursor-pointer">Webhooks</span>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col gap-3 font-mono text-xs max-w-sm mt-2">
                     <div className="flex justify-between items-center bg-[#0a0a0a] p-2 rounded border border-neutral-800/50">
                       <span className="text-neutral-500 font-sans font-medium">Build Command</span>
                       <span className="bg-[#050505] text-[#8b9dce] px-2.5 py-1 rounded border border-neutral-800/50">npm run build</span>
                     </div>
                     <div className="flex justify-between items-center bg-[#0a0a0a] p-2 rounded border border-neutral-800/50">
                       <span className="text-neutral-500 font-sans font-medium">Output Directory</span>
                       <span className="bg-[#050505] text-[#8b9dce] px-2.5 py-1 rounded border border-neutral-800/50">.next</span>
                     </div>
                     <div className="flex justify-between items-center bg-[#0a0a0a] p-2 rounded border border-neutral-800/50">
                       <span className="text-neutral-500 font-sans font-medium">Node.js Version</span>
                       <span className="bg-[#050505] text-[#8b9dce] px-2.5 py-1 rounded border border-neutral-800/50">20.x</span>
                     </div>
                  </div>
                </div>
              </div>
            </div>


          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative px-4 py-24 sm:py-32 border-t border-neutral-800/50">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-16">
            {/* Left Column: Title and text */}
            <div className="md:col-span-5 flex flex-col items-start text-left">
              <p className="text-xs font-semibold tracking-[0.2em] text-[#8b9dce] uppercase mb-4">
                QUESTIONS
              </p>
              <h2 className="text-4xl sm:text-5xl font-medium text-white mb-6">
                The <span className="italic font-light">usual stuff.</span>
              </h2>
              <p className="text-neutral-400 leading-relaxed">
                Can't find what you're after? <a href="#" className="text-white underline decoration-neutral-600 underline-offset-4 hover:decoration-white transition-colors">Email us</a>,
                <br />and we usually reply the same day.
              </p>
            </div>

            {/* Right Column: Accordion */}
            <div className="md:col-span-7">
              <Accordion className="w-full flex flex-col gap-3">
            <AccordionItem value="item-1" className="border border-dashed border-neutral-800/80 rounded-xl px-6">
              <AccordionTrigger className="py-5 text-left text-lg font-medium hover:text-[#8b9dce] hover:no-underline transition-colors">What is Kyte?</AccordionTrigger>
              <AccordionContent className="text-neutral-400 pt-2 pb-6 leading-relaxed">
                Kyte is a fully automated deployment platform tailored specifically for frontend applications like React, Vue, Next.js, and static sites. We abstract away infrastructure so you can simply push your code and get a live URL in seconds.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-2" className="border border-dashed border-neutral-800/80 rounded-xl px-6">
              <AccordionTrigger className="py-5 text-left text-lg font-medium hover:text-[#8b9dce] hover:no-underline transition-colors">How do preview URLs work?</AccordionTrigger>
              <AccordionContent className="text-neutral-400 pt-2 pb-6 leading-relaxed">
                Every time you trigger a deployment on Kyte (via a pull request or branch update), we automatically generate an immutable unique subdomain (e.g. `pr-142.kyte.dev`). This allows you to test that specific build independently from your production environment.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="border border-dashed border-neutral-800/80 rounded-xl px-6">
              <AccordionTrigger className="py-5 text-left text-lg font-medium hover:text-[#8b9dce] hover:no-underline transition-colors">Can I use a custom domain?</AccordionTrigger>
              <AccordionContent className="text-neutral-400 pt-2 pb-6 leading-relaxed">
                Absolutely. You can easily attach custom domains to any of your production environments. We provide automatic, free SSL certificates out of the box for every custom domain you connect.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="border border-dashed border-neutral-800/80 rounded-xl px-6">
              <AccordionTrigger className="py-5 text-left text-lg font-medium hover:text-[#8b9dce] hover:no-underline transition-colors">Do you support monorepos?</AccordionTrigger>
              <AccordionContent className="text-neutral-400 pt-2 pb-6 leading-relaxed">
                Yes, Kyte offers first-class support for modern monorepo architectures including Turborepo, Nx, and Lerna. You can easily configure custom root directories and build commands for each individual project.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="border border-dashed border-neutral-800/80 rounded-xl px-6">
              <AccordionTrigger className="py-5 text-left text-lg font-medium hover:text-[#8b9dce] hover:no-underline transition-colors">How fast is the edge network?</AccordionTrigger>
              <AccordionContent className="text-neutral-400 pt-2 pb-6 leading-relaxed">
                Our global edge network spans 32 regions worldwide. It intelligently routes your static assets to the node geographically closest to your users, consistently delivering single-digit millisecond latency.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6" className="border border-dashed border-neutral-800/80 rounded-xl px-6">
              <AccordionTrigger className="py-5 text-left text-lg font-medium hover:text-[#8b9dce] hover:no-underline transition-colors">Is it free?</AccordionTrigger>
              <AccordionContent className="text-neutral-400 pt-2 pb-6 leading-relaxed">
                Currently, Kyte is in beta and completely free for early adopters and hobbyist developers. We will introduce reasonable tier pricing for enterprise use-cases in the future, but there will always be a generous free tier.
              </AccordionContent>
            </AccordionItem>
              </Accordion>
            </div>
          </div>
        </div>
      </section>

      {/* Massive Faded Logo Banner */}
      <div className="relative w-full overflow-hidden flex justify-center items-center gap-6 md:gap-10 pointer-events-none select-none mt-12 md:mt-24 opacity-30">
        <div className="relative w-[14vw] h-[14vw] max-w-[140px] max-h-[140px]">
          <Image 
              src="/kite-flying.png" 
              alt="Kyte Logo" 
              fill
              className="object-contain invert dark:invert opacity-50 [mask-image:linear-gradient(to_bottom,black_10%,transparent_90%)]"
          />
        </div>
        <h1 className="text-[18vw] font-sans font-bold italic tracking-tight leading-tight text-transparent bg-clip-text bg-gradient-to-b from-[#8b9dce] to-transparent pr-[2vw]">
          Kyte
        </h1>
      </div>


    </main>
  );
}
