import type { Metadata } from 'next'
import './globals.css'
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider } from '@clerk/nextjs'
import { ThemeProvider } from "@/components/theme-provider"

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Kyte — Seamless Frontend Hosting',
  description: 'Deploy your frontend apps seamlessly.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={cn("min-h-screen bg-background text-foreground antialiased font-sans", inter.variable)} suppressHydrationWarning>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
