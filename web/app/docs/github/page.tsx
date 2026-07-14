import type { SVGProps } from "react";
import { Check, GitBranch, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IntegrationFlow } from "@/components/docs-visuals";

const GithubIcon = (props: SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"></path></svg>;

const setupSteps = [
  { title: "Connect your account", detail: "Choose GitHub when creating a project and approve access to the repositories you want Kyte to deploy.", icon: GithubIcon },
  { title: "Choose a repository", detail: "Select the repository and production branch. Kyte checks the project structure before the first deployment.", icon: GitBranch },
  { title: "Confirm the build", detail: "Review the detected framework, build command, and output directory. You can adjust any setting before launch.", icon: Settings2 },
];

export const metadata = { title: "GitHub Integration" };

export default function GitHubDocs() {
  return (
    <article className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <Badge variant="outline" className="font-mono text-[10px] border-indigo-500/30 bg-indigo-500/10 text-indigo-400">GETTING STARTED</Badge>
      <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">Connect GitHub</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">Turn a repository into a project without rebuilding your workflow. Kyte reads the project configuration, builds it, and watches the branch you choose for production.</p>

      <section className="mt-10"><IntegrationFlow /></section>

      <section className="mt-10"><div className="max-w-2xl"><p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">One-time setup</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Set the connection once</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">The project setup flow keeps the choices that affect deployment visible and editable.</p></div><div className="mt-5 grid gap-3">{setupSteps.map((step, index) => { const Icon = step.icon; return <Card key={step.title} className="border-border bg-card shadow-none"><CardHeader className="flex-row items-start gap-4 px-5 py-4"><span className="font-mono text-[11px] text-muted-foreground">0{index + 1}</span><span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground"><Icon className="size-3.5" /></span><div className="min-w-0"><CardTitle className="text-sm font-medium">{step.title}</CardTitle><CardDescription className="mt-1 text-xs leading-5">{step.detail}</CardDescription></div></CardHeader></Card>; })}</div></section>

      <section className="mt-10 border-t border-border pt-8"><div className="flex items-center gap-2"><Check className="size-4 text-primary" /><h2 className="text-lg font-semibold tracking-[-0.02em]">Your next push is enough</h2></div><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Kyte receives the push event and creates a deployment automatically. You do not need GitHub Actions, a pipeline file, or an additional webhook service.</p><Card className="mt-4 border-border bg-muted/30 shadow-none"><CardContent className="flex items-start gap-3 p-4"><span className="mt-0.5 font-mono text-[10px] text-muted-foreground">TIP</span><p className="text-xs leading-5 text-muted-foreground">Use the Deployments tab after setup to see the commit, duration, build logs, and live URL for every push.</p></CardContent></Card></section>
    </article>
  );
}
