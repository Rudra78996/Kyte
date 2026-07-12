import Link from "next/link";
import { ArrowRight, BookOpen, ChevronRight, FileCode2, Globe, Package, Rocket } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-7xl mx-auto flex h-14 items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="bg-neutral-900 p-1.5 rounded-lg border border-neutral-800">
                <Rocket className="w-5 h-5 text-neutral-300" />
              </div>
              <span className="font-bold text-lg tracking-tight">Kyte Docs</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex items-center space-x-6 text-sm font-medium">
              <Link href="/docs" className="transition-colors hover:text-foreground/80 text-foreground">Documentation</Link>
              <Link href="/projects" className="transition-colors hover:text-foreground/80 text-foreground/60 hidden sm:block">Dashboard</Link>
            </nav>
            <Link 
              href="/projects" 
              className="hidden md:flex items-center justify-center bg-white text-black hover:bg-neutral-200 px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
            >
              Go to App <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 container max-w-7xl mx-auto flex flex-col md:flex-row px-4 md:px-8">
        {/* Left Sidebar */}
        <aside className="fixed top-14 z-30 -ml-2 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 md:sticky md:block md:w-[240px] lg:w-[280px]">
          <ScrollArea className="h-full py-6 pr-6 lg:py-8 border-r border-white/5">
            <div className="w-full">
              <div className="pb-4">
                <h4 className="mb-2 px-2 text-sm font-semibold tracking-wide text-neutral-300">Getting Started</h4>
                <div className="grid grid-flow-row auto-rows-max text-sm">
                  <Link href="/docs" className="flex w-full items-center rounded-md border border-transparent px-2 py-1.5 hover:bg-neutral-900 text-neutral-400 hover:text-neutral-200">
                    Overview
                  </Link>
                  <Link href="/docs/nextjs" className="flex w-full items-center rounded-md border border-transparent px-2 py-1.5 hover:bg-neutral-900 text-neutral-400 hover:text-neutral-200">
                    Deploying Next.js
                  </Link>
                  <Link href="/docs/react" className="flex w-full items-center rounded-md border border-transparent px-2 py-1.5 hover:bg-neutral-900 text-neutral-400 hover:text-neutral-200">
                    Deploying React (Vite)
                  </Link>
                  <Link href="/docs/vue" className="flex w-full items-center rounded-md border border-transparent px-2 py-1.5 hover:bg-neutral-900 text-neutral-400 hover:text-neutral-200">
                    Deploying Vue.js
                  </Link>
                </div>
              </div>
              <div className="pb-4">
                <h4 className="mb-2 px-2 text-sm font-semibold tracking-wide text-neutral-300">Advanced</h4>
                <div className="grid grid-flow-row auto-rows-max text-sm">
                  <Link href="/docs/ci-cd" className="flex w-full items-center rounded-md border border-transparent px-2 py-1.5 hover:bg-neutral-900 text-neutral-400 hover:text-neutral-200">
                    Continuous Deployment
                  </Link>
                  <Link href="/docs/custom-domains" className="flex w-full items-center rounded-md border border-transparent px-2 py-1.5 hover:bg-neutral-900 text-neutral-400 hover:text-neutral-200">
                    Custom Domains
                  </Link>
                </div>
              </div>
            </div>
          </ScrollArea>
        </aside>

        <main className="relative py-6 lg:gap-10 lg:py-8 w-full">
          <div className="mx-auto w-full min-w-0 max-w-4xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
