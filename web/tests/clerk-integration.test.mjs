import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")

test("uses Clerk's maintained auth components instead of custom flow hooks", async () => {
  const [signIn, signUp] = await Promise.all([
    read("app/sign-in/[[...sign-in]]/page.tsx"),
    read("app/sign-up/[[...sign-up]]/page.tsx"),
  ])

  assert.match(signIn, /import \{ SignIn \} from "@clerk\/nextjs"/)
  assert.match(signUp, /import \{ SignUp \} from "@clerk\/nextjs"/)
  assert.doesNotMatch(signIn, /useSignIn|redirectCallbackUrl/)
  assert.doesNotMatch(signUp, /useSignUp|redirectCallbackUrl/)
  assert.match(signIn, /fallbackRedirectUrl="\/dashboard"/)
  assert.match(signUp, /fallbackRedirectUrl="\/dashboard"/)
})

test("uses the Next.js 16 proxy and leaves nested Clerk auth routes public", async () => {
  const proxy = await read("proxy.ts")

  assert.match(proxy, /'\/sign-in\(\.\*\)'/)
  assert.match(proxy, /'\/sign-up\(\.\*\)'/)
  assert.match(proxy, /await auth\.protect\(\)/)
  assert.doesNotMatch(proxy, /x-e2e-bypass|mock-jwt-token|__session/)
})

test("keeps Clerk secrets out of the frontend image build", async () => {
  const [dockerignore, dockerfile] = await Promise.all([
    read(".dockerignore"),
    read("Dockerfile"),
  ])

  assert.match(dockerignore, /^\.env\.\*$/m)
  assert.doesNotMatch(dockerfile, /ARG CLERK_SECRET_KEY/)
  assert.doesNotMatch(dockerfile, /ENV CLERK_SECRET_KEY/)
  assert.match(dockerfile, /ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY/)
})

test("streams deployment logs with an authorization header, never a URL token", async () => {
  const [stream, newProject, project] = await Promise.all([
    read("lib/deployment-log-stream.ts"),
    read("app/new/page.tsx"),
    read("app/(app)/projects/[id]/page.tsx"),
  ])

  assert.match(stream, /Authorization: `Bearer \$\{token\}`/)
  assert.match(stream, /Accept: 'text\/event-stream'/)
  assert.doesNotMatch(`${newProject}\n${project}`, /EventSource/)
  assert.doesNotMatch(`${newProject}\n${project}`, /\?token=/)
  assert.match(newProject, /streamDeploymentLogs/)
  assert.match(project, /streamDeploymentLogs/)
})

test("renders stored environment variables as configured without exposing values", async () => {
  const editor = await read("components/environment-variable-editor.tsx")

  assert.match(editor, /hasValue\?: boolean/)
  assert.match(editor, /Stored securely — enter to replace/)
})
