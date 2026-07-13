import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { BookOpen, FileCode2, Package, Globe } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

export default function DocsPage() {
  return (
    <div className="flex-1 space-y-8 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col space-y-4">
        <Badge variant="outline" className="w-fit text-neutral-400 border-neutral-800 bg-neutral-900/50 mb-2">Platform Guide</Badge>
        <h2 className="text-4xl font-extrabold tracking-tight flex items-center gap-3 text-neutral-100">
          <BookOpen className="w-9 h-9 text-neutral-400" />
          Hosting Documentation
        </h2>
        <p className="text-muted-foreground text-lg leading-relaxed max-w-3xl">
          Welcome to the Kyte developer documentation. Kyte features a highly optimized static-hosting engine powered by isolated sandboxes (nsjail) and distributed object storage. We support any frontend framework that outputs static HTML/JS/CSS assets.
        </p>
      </div>

      <Separator className="my-8" />
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/docs/nextjs" className="block group">
          <Card className="bg-neutral-950 border-neutral-800 shadow-sm rounded-lg h-full transition-colors group-hover:border-neutral-700 group-hover:bg-neutral-900/50">
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <FileCode2 className="w-5 h-5 text-neutral-400" />
                Next.js
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-neutral-400">
              Deploy server-side rendered or static Next.js applications seamlessly.
            </CardContent>
          </Card>
        </Link>

        <Link href="/docs/react" className="block group">
          <Card className="bg-neutral-950 border-neutral-800 shadow-sm rounded-lg h-full transition-colors group-hover:border-neutral-700 group-hover:bg-neutral-900/50">
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Package className="w-5 h-5 text-neutral-400" />
                React (Vite)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-neutral-400">
              Ship blazing fast single-page applications built with Vite.
            </CardContent>
          </Card>
        </Link>

        <Link href="/docs/vue" className="block group">
          <Card className="bg-neutral-950 border-neutral-800 shadow-sm rounded-lg h-full transition-colors group-hover:border-neutral-700 group-hover:bg-neutral-900/50">
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Globe className="w-5 h-5 text-neutral-400" />
                Vue.js
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-neutral-400">
              Deploy progressive web apps built with Vue and Nuxt.
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
