import type { Metadata } from 'next'
import './globals.css'
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider } from '@clerk/nextjs'
import { ThemeProvider } from "@/components/theme-provider"

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
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      afterSignOutUrl="/"
      appearance={{
        theme: "simple",
        options: {
          elevation: "flush",
          logoPlacement: "none",
          socialButtonsVariant: "blockButton",
        },
        variables: {
          colorPrimary: "#fafafa",
          colorPrimaryForeground: "#18181b",
          colorForeground: "#fafafa",
          colorMuted: "#18181b",
          colorMutedForeground: "#a1a1aa",
          colorBackground: "#09090b",
          colorInput: "#18181b",
          colorInputForeground: "#fafafa",
          colorBorder: "#27272a",
          colorRing: "#a1a1aa",
          borderRadius: "0.5rem",
        },
        elements: {
          rootBox: "w-full",
          cardBox: "w-full shadow-none",
          card: "w-full bg-transparent",
          header: "mb-2",
          headerTitle: "text-2xl font-semibold tracking-tight",
          headerSubtitle: "text-sm leading-6 text-muted-foreground",
          socialButtonsBlockButton:
            "h-10 !border-0 bg-zinc-900 text-zinc-100 shadow-none ring-1 ring-inset ring-white/[0.06] hover:bg-zinc-800",
          dividerLine: "bg-border",
          dividerText: "text-xs text-muted-foreground",
          formFieldLabel: "text-sm font-medium text-foreground",
          formFieldInput:
            "h-10 border-zinc-800 bg-zinc-900 text-zinc-100 shadow-none",
          formButtonPrimary:
            "h-10 bg-primary text-primary-foreground shadow-none hover:bg-primary/90",
          footer: "bg-transparent",
          footerAction: "bg-transparent",
          footerActionText: "text-muted-foreground",
          footerActionLink: "font-medium text-foreground",
        },
      }}
    >
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
