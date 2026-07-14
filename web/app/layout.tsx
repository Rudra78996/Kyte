import type { Metadata } from 'next'
import './globals.css'
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider } from '@clerk/nextjs'
import { ThemeProvider } from "@/components/theme-provider"
import { dark } from '@clerk/themes'

export const metadata: Metadata = {
  title: {
    template: '%s | Kyte',
    default: 'Kyte',
  },
  description: 'Deploy your frontend apps seamlessly.',
}

import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={{ baseTheme: dark } as unknown as object}>
      <html lang="en" suppressHydrationWarning>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Inter:wght@100..900&display=swap" rel="stylesheet" />
        </head>
        <body className={cn("min-h-screen bg-background text-foreground antialiased font-sans")} suppressHydrationWarning>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
            <TooltipProvider>
              {children}
            </TooltipProvider>
            <Toaster position="bottom-left" />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
