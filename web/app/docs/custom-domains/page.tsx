import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function CustomDomainDocs() {
  return (
    <div className="flex-1 space-y-8 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-neutral-100">
          <Link2 className="w-6 h-6 text-neutral-400" />
          Custom Domains
        </h1>
        <p className="text-muted-foreground text-lg">
          Point your own domain to your deployed projects on Kyte.
        </p>
      </div>
      <Separator className="my-8" />
      
      <div className="grid gap-6">
        <Card className="bg-neutral-950 border-neutral-800 shadow-sm rounded-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-medium tracking-tight">
              Domain Setup
            </CardTitle>
            <CardDescription className="text-neutral-400">
              Configuring DNS records
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-neutral-300 text-sm">
            <p>
              To add a custom domain to your project, you will need to add a CNAME record with your DNS provider (e.g. Cloudflare, Namecheap, Route53) pointing to your project's default Kyte URL.
            </p>
            <div className="bg-neutral-900 px-3 py-2.5 rounded border border-neutral-800 font-mono text-[13px] text-neutral-300 overflow-x-auto">
              CNAME &nbsp;&nbsp;&nbsp; @ &nbsp;&nbsp;&nbsp; your-project.kyte.app
            </div>
            <p className="text-xs text-neutral-500">
              Please note that DNS propagation can take up to 48 hours depending on your registrar.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
