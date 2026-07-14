import { PanelsTopLeft } from "lucide-react";
import { FrameworkGuide } from "@/components/framework-guide";

export const metadata = { title: "Deploy Vue" };

export default function VueDocs() {
  return <FrameworkGuide framework="Vue + Vite" title="Deploy a Vue app" description="Vue projects built with Vite publish cleanly to Kyte as static assets. Kyte detects the framework, then gives you a clear place to review the build before it goes live." icon={PanelsTopLeft} accent="border-emerald-500/30 bg-emerald-500/10 text-emerald-300" buildCommand="npm run build" outputDirectory="dist" configLabel="vite.config.ts" configCode={'import { defineConfig } from "vite";\nimport vue from "@vitejs/plugin-vue";\n\nexport default defineConfig({\n  plugins: [vue()],\n});'} notes={["Verify that npm run build completes in your local project.", "Point client-side navigation at your app entry when needed.", "Use the production branch for the version you want to publish."]} />;
}
