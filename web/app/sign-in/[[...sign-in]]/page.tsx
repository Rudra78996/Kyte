import { SignIn } from "@clerk/nextjs"
import type { Metadata } from "next"
import { AuthPageShell } from "@/components/auth-page-shell"

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Kyte account.",
}

export default function SignInPage() {
  return (
    <AuthPageShell>
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/dashboard"
        oauthFlow="redirect"
      />
    </AuthPageShell>
  )
}
