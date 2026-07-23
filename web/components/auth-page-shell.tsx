import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"

interface AuthPageShellProps {
  children: ReactNode
}

export function AuthPageShell({ children }: AuthPageShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#09090b] text-zinc-50">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(113,113,122,0.16),transparent_38%)]" />
      <div aria-hidden="true" className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8">
          <div className="flex items-center justify-center">
            <Link
              href="/"
              aria-label="Go to Kyte home"
              className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              <Image
                src="/kite-flying.png"
                alt=""
                width={22}
                height={22}
                className="size-6 object-contain invert"
                priority
              />
              <span className="text-lg font-semibold tracking-[-0.03em]">Kyte</span>
            </Link>
          </div>

          <div className="flex flex-1 items-center justify-center py-12">
            <section className="w-full max-w-[420px] rounded-2xl bg-zinc-950/80 p-5 ring-1 ring-inset ring-white/[0.08] backdrop-blur sm:p-8">
              {children}
            </section>
          </div>

          <p className="text-center text-xs text-zinc-600">
            © 2026 Kyte · <Link href="/terms" className="transition-colors hover:text-zinc-400">Terms</Link>
          </p>
      </div>
    </main>
  )
}
