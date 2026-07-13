import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Package } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function ReactDocs() {
  return (
    <div className="flex-1 space-y-8 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-neutral-100">
          <Package className="w-6 h-6 text-neutral-400" />
          Deploying React (Vite)
        </h1>
        <p className="text-muted-foreground text-lg">
          Learn how to deploy a lightning-fast React application built with Vite.
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
              Using React with Vite
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-neutral-300 text-sm">
            <p>
              Vite is a build tool that natively exports static Single Page Applications (SPAs). It is natively supported by the platform with zero extra configuration needed.
            </p>
            <div className="flex items-center gap-2 mt-4 text-neutral-400 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Ready out of the box
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
                dist
              </div>
              <span className="text-xs text-neutral-500 mt-1">Vite places compiled assets in &apos;dist&apos;.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
