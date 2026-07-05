import type { Metadata } from 'next'
import './globals.css'
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'Deployly - Seamless Frontend Hosting',
  description: 'Deploy your frontend apps seamlessly to our global edge network.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased selection:bg-blue-500/30">
        <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur supports-[backdrop-filter]:bg-slate-950/60">
          <div className="container flex h-14 max-w-screen-2xl items-center justify-between px-4">
            <a href="/" className="flex items-center space-x-2">
              <span className="font-bold sm:inline-block tracking-tight text-lg">Deployly</span>
            </a>
            <div className="flex items-center space-x-4">
              <a href="/dashboard" className="text-sm font-medium transition-colors hover:text-slate-300 text-slate-400">
                Dashboard
              </a>
            </div>
          </div>
        </header>
        <main className="container max-w-screen-2xl px-4 flex-1">
          {children}
        </main>
      </body>
    </html>
  )
}
