import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <div className="space-y-6 max-w-3xl">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white">
          Ship your frontend <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
            in seconds.
          </span>
        </h1>
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto">
          Deployly is the fastest way to host your static sites and frontend frameworks. 
          Push to GitHub, trigger a build, and get a live URL instantly.
        </p>
        
        <div className="flex items-center justify-center gap-4 pt-4">
          <Link href="/login">
            <Button size="lg" className="bg-white text-black hover:bg-slate-200 font-semibold px-8">
              Start Deploying
            </Button>
          </Link>
          <Link href="https://github.com/mdn/todo-react" target="_blank">
            <Button size="lg" variant="outline" className="px-8 border-slate-700 hover:bg-slate-800">
              View Example
            </Button>
          </Link>
        </div>
      </div>
      
      <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl text-left">
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
          <h3 className="text-xl font-semibold text-white mb-2">Instant Rollbacks</h3>
          <p className="text-slate-400">Revert to any previous deployment instantly with zero downtime and no rebuilding required.</p>
        </div>
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
          <h3 className="text-xl font-semibold text-white mb-2">Live Terminal</h3>
          <p className="text-slate-400">Watch your build logs stream in real-time. Know exactly what's happening under the hood.</p>
        </div>
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
          <h3 className="text-xl font-semibold text-white mb-2">Global Edge Network</h3>
          <p className="text-slate-400">Your assets are served incredibly fast from object storage directly to your users.</p>
        </div>
      </div>
    </div>
  );
}
