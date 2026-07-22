"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useAuth } from "@clerk/nextjs";

export default function Navbar() {
  const { isSignedIn } = useAuth();

  return (
    <header className="w-full bg-transparent pt-4 relative z-50">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 lg:px-12">
        {/* Left: Logo */}
        <Link
          href="/"
          aria-label="Go to homepage"
          className="flex items-center gap-3 group"
        >
          <Image 
            src="/kite-flying.png" 
            alt="Kyte Logo" 
            width={26} 
            height={26} 
            className="object-contain invert dark:invert"
          />
          <span className="font-sans text-xl font-bold tracking-[0.15em] text-white transition-colors group-hover:opacity-80 italic flex items-center pt-0.5">
            <span className="text-neutral-400">K</span>yte
          </span>
        </Link>

        {/* Center: Links */}
        <nav className="hidden items-center gap-7 text-[13px] font-medium text-neutral-300 md:flex" aria-label="Primary navigation">
          <Link href="/#how-it-works" className="transition-colors hover:text-white">How it works</Link>
          <Link href="/#features" className="transition-colors hover:text-white">Features</Link>
          <Link href="/#pricing" className="transition-colors hover:text-white">Pricing</Link>
          <Link href="/docs" className="transition-colors hover:text-white">Docs</Link>
          <Link href="/contact" className="transition-colors hover:text-white">Contact</Link>
        </nav>

        {/* Right: Auth */}
        <div className="flex items-center gap-6">
          {!isSignedIn ? (
            <>
              <Link href="/sign-in" className="text-[13px] font-medium text-neutral-300 hover:text-white transition-colors hidden sm:block">
                Login
              </Link>
              <Button nativeButton={false} render={<Link href="/sign-up" />} className="h-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-[13px] px-6 font-medium border-0 shadow-none">Sign up</Button>
            </>
          ) : (
            <Button nativeButton={false} render={<Link href="/dashboard" />} className="h-8 rounded-full bg-white hover:bg-neutral-200 text-black text-[13px] px-6 font-medium border-0 shadow-none">Dashboard</Button>
          )}
        </div>
      </div>
    </header>
  );
}
