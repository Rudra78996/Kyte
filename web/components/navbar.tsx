"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

export default function Navbar() {
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
        <nav className="hidden md:flex items-center gap-8 text-[13px] font-medium text-neutral-300">
          <Link href="#product" className="flex items-center gap-1 hover:text-white transition-colors">
            Product <ChevronDown size={14} className="opacity-50" />
          </Link>
          <Link href="#frameworks" className="hover:text-white transition-colors">Frameworks</Link>
          <Link href="#deployments" className="hover:text-white transition-colors">Deployments</Link>
          <Link href="#features" className="hover:text-white transition-colors">Features</Link>
          <Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link>
          <Link href="#resources" className="flex items-center gap-1 hover:text-white transition-colors">
            Resources <ChevronDown size={14} className="opacity-50" />
          </Link>
        </nav>

        {/* Right: Auth */}
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-[13px] font-medium text-neutral-300 hover:text-white transition-colors hidden sm:block">
            Login
          </Link>
          <Link href="/login">
            <Button className="h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-[13px] px-5 font-medium border-0 shadow-none">
              Signup
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
