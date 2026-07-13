import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, FileCode2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function NextjsDocs() {
  return (
    <div className="flex-1 space-y-8 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-neutral-100">
          <FileCode2 className="w-6 h-6 text-neutral-400" />
          Deploying Next.js
        </h1>
        <p className="text-muted-foreground text-lg">
          Learn how to deploy a Next.js application as a static export on Kyte.
        </p>
      </div>
      <Separator className="my-8" />
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-neutral-950 border-neutral-800 shadow-sm rounded-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-medium tracking-tight">
              1. Preparation
            </CardTitle>
            <CardDescription className="text-neutral-400">
              Configure Next.js for Static Export
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-neutral-300">
            <p className="text-sm">
              Next.js must be told to output static files rather than relying on a Node.js server.
            </p>
            <div className="bg-neutral-900 p-4 rounded-md border border-neutral-800 font-mono text-[13px] leading-relaxed">
              <span className="text-neutral-500">{"// next.config.js"}</span><br/>
              <span className="text-neutral-300">const</span> nextConfig = {'{'}<br/>
              &nbsp;&nbsp;<span className="text-neutral-300">output</span>: <span className="text-neutral-400">&apos;export&apos;</span>,<br/>
              {'}'};<br/>
              <br/>
              <span className="text-neutral-300">export default</span> nextConfig;
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-950 border-neutral-800 shadow-sm rounded-lg">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-medium tracking-tight">
              2. Platform Settings
            </CardTitle>
            <CardDescription className="text-neutral-400">
              Recommended configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-neutral-500 uppercase font-semibold tracking-wider">Build Command</span>
              <div className="bg-neutral-900 px-3 py-2.5 rounded border border-neutral-800 font-mono text-[13px] text-neutral-300">
                npm run build
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-neutral-500 uppercase font-semibold tracking-wider">Output Directory</span>
              <div className="bg-neutral-900 px-3 py-2.5 rounded border border-neutral-800 font-mono text-[13px] text-neutral-300">
                out
              </div>
              <span className="text-xs text-neutral-500 mt-1">Next.js places static exports in &apos;out&apos;, not &apos;.next&apos;.</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4 flex gap-3 text-sm text-neutral-400">
        <AlertCircle className="w-5 h-5 text-neutral-500 shrink-0" />
        <div className="space-y-1">
          <h4 className="font-medium text-neutral-200">Server Components Notice</h4>
          <p className="leading-relaxed">
            Dynamic Server Components that rely on cookies, headers, or request-time data cannot be exported statically. Ensure your data fetching happens at build time or via client-side data fetching.
          </p>
        </div>
      </div>
    </div>
  );
}
