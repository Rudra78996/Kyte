import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GitBranch } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function CiCdDocs() {
  return (
    <div className="flex-1 space-y-8 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-neutral-100">
          <GitBranch className="w-6 h-6 text-neutral-400" />
          Continuous Deployment
        </h1>
        <p className="text-muted-foreground text-lg">
          Connect your GitHub repository to automatically deploy changes on every push.
        </p>
      </div>
      <Separator className="my-8" />
      
      <div className="grid gap-6">
        <Card className="bg-neutral-950 border-neutral-800 shadow-sm rounded-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-medium tracking-tight">
              Webhook Integration
            </CardTitle>
            <CardDescription className="text-neutral-400">
              Automate your workflow
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-neutral-300 text-sm">
            <p>
              Kyte supports automatic deployments out of the box when you link a GitHub repository. Every time you push to the configured production branch, a new build is triggered automatically in an isolated sandbox.
            </p>
            <p>
              No additional configuration or GitHub Actions are required.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
