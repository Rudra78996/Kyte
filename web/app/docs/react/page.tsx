import { Atom } from "lucide-react";
import { FrameworkGuide } from "@/components/framework-guide";

export const metadata = { title: "Deploy React" };

export default function ReactDocs() {
  return <FrameworkGuide framework="React + Vite" title="Deploy a React app" description="Kyte works with the static files Vite produces. Connect the repository, confirm the detected settings, and every production push can publish a new version." icon={Atom} accent="border-cyan-500/30 bg-cyan-500/10 text-cyan-300" buildCommand="npm run build" outputDirectory="dist" configLabel="vite.config.ts" configCode={'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({\n  plugins: [react()],\n});'} notes={["Build your app locally once to confirm the dist folder exists.", "Use a client-side router fallback for single-page routes.", "Keep environment values in the project settings, not in the repository."]} />;
}
