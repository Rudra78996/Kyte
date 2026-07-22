import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import MarketingFooter from "@/components/marketing-footer";
import Navbar from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description: "Terms and conditions for using the Kyte deployment platform.",
};

const sections = [
  { id: "service", title: "1. The service" },
  { id: "accounts", title: "2. Accounts and access" },
  { id: "acceptable-use", title: "3. Acceptable use" },
  { id: "repositories", title: "4. Repositories and deployments" },
  { id: "limits", title: "5. Limits and fair use" },
  { id: "domains", title: "6. Domains and third parties" },
  { id: "security", title: "7. Security and data" },
  { id: "availability", title: "8. Availability and beta status" },
  { id: "ownership", title: "9. Ownership" },
  { id: "termination", title: "10. Suspension and termination" },
  { id: "disclaimers", title: "11. Disclaimers and liability" },
  { id: "changes", title: "12. Changes and contact" },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="border-b border-neutral-800/70 bg-[radial-gradient(70%_70%_at_50%_0%,rgba(139,157,206,0.12),transparent_70%)]">
        <Navbar />
        <header className="mx-auto max-w-6xl px-6 pb-16 pt-16 sm:pb-20 sm:pt-24">
          <Badge variant="outline" className="border-[#8b9dce]/30 bg-[#8b9dce]/10 text-[#aebce2]"><FileText className="mr-1 size-3" />LEGAL</Badge>
          <h1 className="mt-7 max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-white sm:text-6xl">Terms and Conditions</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-400">These terms describe the rules for using Kyte, including account responsibilities, deployment limits, hosted content, and the platform&apos;s current beta status.</p>
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.12em] text-neutral-600">Effective July 22, 2026 · Last updated July 22, 2026</p>
        </header>
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 lg:grid-cols-[230px_minmax(0,1fr)] lg:py-20">
        <aside className="hidden lg:block">
          <nav className="sticky top-8 flex flex-col gap-1 border-l border-neutral-800 pl-4 text-xs" aria-label="Terms sections">
            {sections.map((section) => <Link key={section.id} href={`#${section.id}`} className="py-1.5 text-neutral-500 transition-colors hover:text-white">{section.title}</Link>)}
          </nav>
        </aside>

        <article className="min-w-0">
          <Card className="mb-10 border-neutral-800 bg-neutral-900/30 shadow-none">
            <CardContent className="p-6 text-sm leading-6 text-neutral-300">By creating an account, connecting a repository, deploying a project, or otherwise using Kyte, you agree to these Terms. If you do not agree, do not use the service. If you use Kyte for an organization, you confirm that you can accept these Terms for that organization.</CardContent>
          </Card>

          <div className="flex flex-col gap-12">
            <TermsSection id="service" title="1. The service">
              <p>Kyte is a managed platform for building and hosting supported static web applications from source repositories. Features may include GitHub connection, build configuration, environment variables, deployment logs, generated project URLs, custom domains, webhook-triggered builds, and basic observability.</p>
              <p>Kyte does not promise support for every framework, package, build script, server runtime, or repository structure. Next.js projects must currently produce a static export; request-time server rendering and private application servers are outside the hosted static-site service.</p>
            </TermsSection>

            <TermsSection id="accounts" title="2. Accounts and access">
              <p>You must provide accurate account information, keep your authentication methods secure, and promptly report suspected unauthorized access. You are responsible for activity performed through your account and organizations you control.</p>
              <p>Do not share access tokens, deploy keys, passwords, or private keys through contact forms, build logs, project names, or other public fields. You must have authority to connect every repository, domain, and organization you add to Kyte.</p>
            </TermsSection>

            <TermsSection id="acceptable-use" title="3. Acceptable use">
              <p>You may not use Kyte to distribute malware, phishing pages, stolen content, unlawful material, abusive automation, denial-of-service traffic, credential harvesters, deceptive impersonation, or content that infringes another person&apos;s rights.</p>
              <p>You may not probe or bypass platform isolation, quotas, authentication, webhook verification, rate limits, domain controls, or administrative restrictions. Automated commits or requests intended to exhaust build, storage, network, or compute capacity are prohibited.</p>
            </TermsSection>

            <TermsSection id="repositories" title="4. Repositories and deployments">
              <p>You retain responsibility for your source code and deployed output. You grant Kyte the limited permission needed to clone connected repositories, install dependencies, execute configured build commands, store deployment artifacts, and serve the resulting website.</p>
              <p>Build commands execute code from your repository and its dependencies. Review dependencies and scripts before deploying. Do not place secrets in client-side bundles: any value compiled into browser-delivered JavaScript can be viewed by visitors.</p>
              <p>A failed deployment should not replace the last successful version, but you remain responsible for testing the published result and maintaining your own source-code backups.</p>
            </TermsSection>

            <TermsSection id="limits" title="5. Limits and fair use">
              <p>Accounts are subject to project, concurrent deployment, storage, traffic, and webhook limits shown in the product or communicated by Kyte. The current free beta generally allows up to four projects, one webhook-enabled project, and 30 webhook-triggered builds in a rolling 24-hour period; administrators may set different limits for individual accounts or the platform.</p>
              <p>Kyte may queue, reject, cancel, pause, or rate-limit work to protect platform stability, respond to abuse, perform maintenance, or enforce these Terms. Contact Kyte before relying on workloads that need higher capacity.</p>
            </TermsSection>

            <TermsSection id="domains" title="6. Domains and third parties">
              <p>You are responsible for domain ownership, DNS records, renewals, and the content served from your domains. DNS and certificate issuance depend on third-party systems and may take time to propagate.</p>
              <p>Kyte relies on third-party services such as Clerk for authentication, GitHub for repository access and webhooks, DNS and certificate providers, and a form-processing service for contact submissions. Your use of those services may also be governed by their terms and privacy practices.</p>
            </TermsSection>

            <TermsSection id="security" title="7. Security and data">
              <p>Kyte applies safeguards such as encrypted stored GitHub credentials, signed webhook verification, isolated builds, HTTPS, authorization checks, and deployment limits. No internet service is completely secure, and you must evaluate whether Kyte is appropriate for your code and data.</p>
              <p>Kyte processes account identifiers, repository metadata, encrypted connection credentials, deployment configuration, build logs, project traffic measurements, and support messages as needed to operate and secure the service. Hosted websites may receive automated traffic, crawlers, and network requests unrelated to human visitors.</p>
            </TermsSection>

            <TermsSection id="availability" title="8. Availability and beta status">
              <p>Kyte is currently an early-stage beta service. Features, limits, URLs, storage, APIs, and availability may change. Maintenance, upstream failures, security incidents, capacity constraints, or software defects may interrupt builds or hosted websites.</p>
              <p>Do not treat Kyte as your only copy of source code, deployment artifacts, logs, analytics, or configuration. Maintain a recovery plan appropriate for your application.</p>
            </TermsSection>

            <TermsSection id="ownership" title="9. Ownership">
              <p>You keep ownership of content you submit and deploy. Kyte and its licensors retain ownership of the platform software, interface, documentation, branding, and other service materials. Feedback may be used to improve Kyte without an obligation to compensate you.</p>
            </TermsSection>

            <TermsSection id="termination" title="10. Suspension and termination">
              <p>You may stop using Kyte and delete projects through the product. Kyte may suspend deployments, disable a site, restrict an account, or delete content when reasonably necessary for security, legal compliance, platform integrity, prolonged inactivity, or a violation of these Terms.</p>
              <p>When an account or project is deleted, related deployments, settings, logs, domains, and analytics may be permanently removed. Some records may be retained where required for security, backups, dispute handling, or legal obligations.</p>
            </TermsSection>

            <TermsSection id="disclaimers" title="11. Disclaimers and liability">
              <p>To the maximum extent allowed by law, Kyte is provided “as is” and “as available,” without warranties of uninterrupted operation, fitness for a particular purpose, merchantability, non-infringement, or error-free results.</p>
              <p>To the maximum extent allowed by law, Kyte&apos;s operator will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages; lost profits, revenue, data, goodwill, or business opportunities; or failures caused by your code, dependencies, DNS, GitHub, authentication providers, or other third parties.</p>
            </TermsSection>

            <TermsSection id="changes" title="12. Changes and contact">
              <p>Kyte may update these Terms as the platform changes. The effective date above will be revised when updates are published. Continued use after an update means you accept the revised Terms.</p>
              <p>Questions about these Terms or the service can be sent through the <Link href="/contact" className="text-white underline decoration-neutral-600 underline-offset-4 hover:decoration-white">contact page</Link>.</p>
            </TermsSection>
          </div>

          <Link href="/" className="mt-14 inline-flex items-center gap-2 text-sm text-neutral-400 transition-colors hover:text-white"><ArrowLeft className="size-4" />Back to Kyte</Link>
        </article>
      </div>
      <MarketingFooter />
    </main>
  );
}

function TermsSection({ children, id, title }: { children: React.ReactNode; id: string; title: string }) {
  return (
    <section id={id} className="scroll-mt-8 border-t border-neutral-800 pt-8">
      <h2 className="text-xl font-medium tracking-[-0.02em] text-white">{title}</h2>
      <div className="mt-4 flex flex-col gap-4 text-sm leading-7 text-neutral-400">{children}</div>
    </section>
  );
}
