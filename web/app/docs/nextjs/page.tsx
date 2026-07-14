import { Triangle } from "lucide-react";
import { FrameworkGuide } from "@/components/framework-guide";

export const metadata = { title: "Deploy Next.js" };

export default function NextjsDocs() {
  return <FrameworkGuide framework="Next.js" title="Deploy a Next.js static export" description="Deploy a Next.js project to Kyte by exporting it as static files. The build output is portable, fast to publish, and ready for a production URL." icon={Triangle} accent="border-sky-500/30 bg-sky-500/10 text-sky-300" buildCommand="npm run build" outputDirectory="out" configLabel="next.config.ts" configCode={'import type { NextConfig } from "next";\n\nconst nextConfig: NextConfig = {\n  output: "export",\n};\n\nexport default nextConfig;'} notes={["Set output: \"export\" in your Next.js config.", "Keep request-time rendering out of routes you want to deploy.", "Confirm the generated out directory before publishing."]} />;
}
