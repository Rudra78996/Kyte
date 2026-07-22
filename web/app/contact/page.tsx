import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ContactForm from "@/components/contact-form";
import Navbar from "@/components/navbar";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Kyte about deployment capacity, setup, or product questions.",
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = await searchParams;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50 lg:h-screen lg:overflow-hidden">
      <Navbar />
      <div className="relative mx-auto min-h-[calc(100vh-5rem)] max-w-3xl border-x border-dashed border-neutral-800/70 lg:h-[calc(100vh-5rem)] lg:min-h-0">
        <div className="relative h-24 border-b border-dashed border-neutral-800/70 sm:h-28">
          <span className="absolute bottom-4 right-5 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-700">Replies within one business day</span>
        </div>

        <header className="relative flex h-24 items-center gap-5 border-b border-dashed border-neutral-800/70 px-5 sm:px-8">
          <Link href="/" aria-label="Back to Kyte" className="flex size-8 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 transition-colors hover:text-white">
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.035em] text-white">Contact</h1>
            <p className="mt-1 text-xs text-neutral-500">Questions about Kyte, deployment setup, or more capacity.</p>
          </div>
        </header>

        <section className="relative">
          <ContactForm capacityRequest={topic === "capacity"} />
        </section>

        <footer className="relative flex flex-col gap-3 border-t border-dashed border-neutral-800/70 px-5 py-4 text-xs text-neutral-600 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>Do not send passwords, tokens, or private keys.</p>
          <div className="flex gap-5"><Link href="/docs" className="hover:text-white">Documentation</Link><Link href="/terms" className="hover:text-white">Terms</Link></div>
        </footer>
      </div>
    </main>
  );
}
