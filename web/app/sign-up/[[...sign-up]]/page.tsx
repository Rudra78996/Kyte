import { SignUp } from "@clerk/nextjs"
import type { Metadata } from "next"
import { AuthPageShell } from "@/components/auth-page-shell"

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your Kyte account.",
}

export default function SignUpPage() {
  return (
    <AuthPageShell>
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/dashboard"
        oauthFlow="redirect"
      />
    </AuthPageShell>
  )
}
