"use client";

import { useApiRequest } from '@/hooks/use-api';
import Link from 'next/link';
import { Plus, ArrowRight, Activity, Zap, Box, Cloud } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const apiRequest = useApiRequest();
  const [projectCount, setProjectCount] = useState(0);

  useEffect(() => {
    // We can fetch projects just to get the count for the stats
    (async () => {
      try {
        const data = await apiRequest('GET', '/projects');
        setProjectCount(data.projects?.length || 0);
      } catch (err) {}
    })();
  }, []);

  return (
    <div className="flex flex-1 flex-col h-full w-full bg-[#000] text-[#EDEDED] p-8 md:p-12">
      <div className="max-w-5xl mx-auto w-full h-full flex flex-col pt-10">
        
        {/* Hero Section */}
        <div className="flex flex-col mb-12">
          <div className="flex items-center gap-2 mb-2 text-[#888]">
            <Cloud className="w-4 h-4" />
            <span className="text-sm font-medium tracking-wider uppercase">Overview</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            Acme Inc. Workspace
          </h1>
          <p className="text-lg text-[#888] max-w-2xl font-light">
            Welcome back. Select a project from the sidebar to view deployments, configure settings, and monitor logs, or deploy something new.
          </p>
        </div>

        {/* Quick Actions / Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          
          <div className="flex flex-col p-6 rounded-xl border border-[#1E1E1E] bg-[#0A0A0A] hover:border-[#333] transition-colors relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-10 -mt-10 transition-opacity opacity-0 group-hover:opacity-100" />
            <div className="w-10 h-10 rounded-lg bg-[#111] border border-[#222] flex items-center justify-center mb-4">
              <Box className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-2xl font-semibold text-white mb-1">{projectCount}</h3>
            <span className="text-sm text-[#888]">Active Projects</span>
          </div>

          <div className="flex flex-col p-6 rounded-xl border border-[#1E1E1E] bg-[#0A0A0A] hover:border-[#333] transition-colors relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-3xl -mr-10 -mt-10 transition-opacity opacity-0 group-hover:opacity-100" />
            <div className="w-10 h-10 rounded-lg bg-[#111] border border-[#222] flex items-center justify-center mb-4">
              <Activity className="w-5 h-5 text-green-400" />
            </div>
            <h3 className="text-2xl font-semibold text-white mb-1">99.9%</h3>
            <span className="text-sm text-[#888]">Platform Uptime</span>
          </div>

          <div className="flex flex-col p-6 rounded-xl border border-[#1E1E1E] bg-[#0A0A0A] hover:border-[#333] transition-colors relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -mr-10 -mt-10 transition-opacity opacity-0 group-hover:opacity-100" />
            <div className="w-10 h-10 rounded-lg bg-[#111] border border-[#222] flex items-center justify-center mb-4">
              <Zap className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-2xl font-semibold text-white mb-1">0.4s</h3>
            <span className="text-sm text-[#888]">Avg. Build Time</span>
          </div>

        </div>

        {/* CTA Card */}
        <div className="mt-auto md:mt-0 p-8 rounded-xl border border-[#1E1E1E] bg-gradient-to-b from-[#0A0A0A] to-[#000] flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
          
          <div className="flex flex-col z-10">
            <h2 className="text-xl font-medium text-white mb-2">Deploy a new project</h2>
            <p className="text-sm text-[#888] max-w-md">
              Connect a GitHub repository or start from a template to get your next app online in seconds.
            </p>
          </div>
          
          <Link href="/new" className="z-10 shrink-0">
            <button className="flex items-center gap-2 bg-white text-black hover:bg-gray-200 h-10 px-5 rounded-md text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" />
              Create Project
            </button>
          </Link>
        </div>

      </div>
    </div>
  );
}
