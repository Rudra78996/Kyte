import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import { Check, GitBranch, Radio } from "lucide-react"

interface AuthPageShellProps {
  children: ReactNode
}

export function AuthPageShell({ children }: AuthPageShellProps) {
  return (
    <main className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.1fr)_minmax(440px,0.9fr)]">
        <section className="relative hidden overflow-hidden border-r bg-card lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
          <div
            aria-hidden="true"
            className="absolute -right-32 -top-32 size-96 rounded-full border border-border/60"
          />
          <div
            aria-hidden="true"
            className="absolute -right-16 -top-16 size-64 rounded-full border border-border/40"
          />

          <Link
            href="/"
            aria-label="Go to Kyte home"
            className="relative inline-flex w-fit items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-10 items-center justify-center rounded-xl border bg-background shadow-sm">
              <Image
                src="/kite-flying.png"
                alt=""
                width={24}
                height={24}
                className="size-6 object-contain dark:invert"
                priority
              />
            </span>
            <span className="text-lg font-semibold tracking-tight">Kyte</span>
          </Link>

          <div className="relative max-w-xl">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Developer deployment workspace
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-[-0.04em] xl:text-5xl">
              From commit to live URL, without the ceremony.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
              Connect a repository, ship a preview, and follow every deployment
              from one focused workspace.
            </p>

            <div className="mt-10 overflow-hidden rounded-2xl border bg-background/70 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <GitBranch className="size-4 text-muted-foreground" />
                  <span className="font-mono text-xs">main</span>
                </div>
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  deploy #042
                </span>
              </div>
              <div className="grid grid-cols-3 divide-x">
                <DeploymentStep
                  icon={<Check className="size-3.5" />}
                  label="Commit"
                  value="received"
                />
                <DeploymentStep
                  icon={<Check className="size-3.5" />}
                  label="Build"
                  value="passed"
                />
                <DeploymentStep
                  icon={<Radio className="size-3.5" />}
                  label="Release"
                  value="live"
                />
              </div>
            </div>
          </div>

          <p className="relative text-xs text-muted-foreground">
            A small deployment platform built for focused projects.
          </p>
        </section>

        <section className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:px-14">
          <div className="flex items-center justify-between lg:hidden">
            <Link
              href="/"
              aria-label="Go to Kyte home"
              className="inline-flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-9 items-center justify-center rounded-lg border bg-card">
                <Image
                  src="/kite-flying.png"
                  alt=""
                  width={22}
                  height={22}
                  className="size-[22px] object-contain dark:invert"
                  priority
                />
              </span>
              <span className="font-semibold tracking-tight">Kyte</span>
            </Link>
          </div>

          <div className="flex flex-1 items-center justify-center py-10">
            <div className="w-full max-w-[400px]">{children}</div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            © 2026 Kyte
          </p>
        </section>
      </div>
    </main>
  )
}

function DeploymentStep({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-2 px-4 py-4">
      <span className="flex size-6 items-center justify-center rounded-full border text-muted-foreground">
        {icon}
      </span>
      <div>
        <p className="text-xs font-medium">{label}</p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {value}
        </p>
      </div>
    </div>
  )
}
