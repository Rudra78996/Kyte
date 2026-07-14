"use client";

import { useSignIn } from '@clerk/nextjs'
import { GitBranch } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { FcGoogle } from "react-icons/fc";
import { FaGithub, FaReact, FaPython } from "react-icons/fa";
import { SiNextdotjs } from "react-icons/si";
import { VscSourceControl } from "react-icons/vsc";

export default function Page() {
  const { signIn } = useSignIn();
  const [email, setEmail] = useState('');
  useEffect(() => { document.title = "Sign In | Kyte"; }, []);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleOAuth = (strategy: 'oauth_google' | 'oauth_github') => {
    if (!signIn) return;
    signIn.sso({
      strategy,
      redirectUrl: '/dashboard',
      redirectCallbackUrl: '/sso-callback',
    });
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      const { error } = await signIn.password({ 
        identifier: email, 
        password 
      });
      if (error) {
        setErrorMsg('Invalid email or password. Please try again.');
        return;
      }
      
      if (signIn.status === 'complete') {
        await signIn.finalize({
          navigate: async ({ decorateUrl }) => {
            window.location.href = decorateUrl('/dashboard');
          }
        });
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen gap-3 px-4 py-10 md:py-16 bg-neutral-50 dark:bg-neutral-950 overflow-hidden">
      {/* Floating Icons Background */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden hidden md:block">
        <div className="absolute animate-float-slow left-[8%] top-[15%]" style={{ animationDelay: '0s' }}>
          <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/50 shadow-[0_1px_3px_rgba(16,24,40,0.04)] p-2 opacity-60 dark:opacity-40">
            <FaReact className="w-5 h-5 text-[#61dafb]" />
          </div>
        </div>
        <div className="absolute animate-float-slow right-[10%] top-[12%]" style={{ animationDelay: '0.6s' }}>
          <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/50 shadow-[0_1px_3px_rgba(16,24,40,0.04)] p-2 opacity-60 dark:opacity-40">
            <SiNextdotjs className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
          </div>
        </div>
        <div className="absolute animate-float-slow left-[5%] top-[55%]" style={{ animationDelay: '1.2s' }}>
          <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/50 shadow-[0_1px_3px_rgba(16,24,40,0.04)] p-2 opacity-60 dark:opacity-40">
            <FaPython className="w-5 h-5 text-[#3776ab]" />
          </div>
        </div>
        <div className="absolute animate-float-slow right-[6%] top-[50%]" style={{ animationDelay: '0.3s' }}>
          <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/50 shadow-[0_1px_3px_rgba(16,24,40,0.04)] p-2 opacity-60 dark:opacity-40">
            <GitBranch className="w-5 h-5 text-[#f14e32]" />
          </div>
        </div>
        <div className="absolute animate-float-slow left-[12%] top-[80%]" style={{ animationDelay: '0.9s' }}>
          <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/50 shadow-[0_1px_3px_rgba(16,24,40,0.04)] p-2 opacity-60 dark:opacity-40">
            <VscSourceControl className="w-5 h-5 text-blue-400" />
          </div>
        </div>
        <div className="absolute animate-float-slow right-[12%] top-[78%]" style={{ animationDelay: '1.5s' }}>
          <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/50 shadow-[0_1px_3px_rgba(16,24,40,0.04)] p-2 opacity-60 dark:opacity-40">
            <FaReact className="w-5 h-5 text-[#61dafb]" />
          </div>
        </div>
        <div className="absolute animate-float-slow left-[18%] top-[35%]" style={{ animationDelay: '0.4s' }}>
          <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/50 shadow-[0_1px_3px_rgba(16,24,40,0.04)] p-2 opacity-60 dark:opacity-40">
            <FaPython className="w-5 h-5 text-[#ffd343]" />
          </div>
        </div>
        <div className="absolute animate-float-slow right-[16%] top-[32%]" style={{ animationDelay: '1s' }}>
          <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/50 shadow-[0_1px_3px_rgba(16,24,40,0.04)] p-2 opacity-60 dark:opacity-40">
            <SiNextdotjs className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
          </div>
        </div>
      </div>

      <div className="z-10 w-full max-w-[460px] flex flex-col items-center">
        <div className="relative rounded-2xl bg-white dark:bg-neutral-900/50 border border-neutral-200/70 dark:border-neutral-800/70 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-16px_rgba(16,24,40,0.10)] dark:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.5)] w-full max-w-[460px] flex flex-col items-center px-6 py-8 md:px-9 md:py-10">
          <div className="w-full text-center">
            <div className="mb-3 flex justify-center">
              <Link className="inline-flex items-center justify-center" aria-label="home" href="/">
                <Image src="/kite-flying.png" alt="logo" width={40} height={40} className="w-10 h-10 object-contain dark:invert" />
              </Link>
            </div>
            <h1 className="text-xl font-medium tracking-tight text-neutral-950 dark:text-white">Sign in to <Link href="/">Kyte</Link></h1>
            <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400 [&_a]:text-neutral-900 dark:[&_a]:text-neutral-100 [&_a]:underline [&_a]:underline-offset-[5px] [&_a]:decoration-neutral-300 dark:[&_a]:decoration-neutral-700 hover:[&_a]:decoration-blue-500">
              Don&apos;t have an account? <Link href="/sign-up">Signup here</Link>
            </p>
            
            <div className="max-w-xl mx-auto mt-5 text-left">
              <div className="grid md:grid-cols-2 items-center gap-3">
                <button onClick={() => handleOAuth('oauth_google')} type="button" className="inline-flex items-center justify-center gap-1 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.99] bg-white border border-neutral-200/70 hover:bg-neutral-50 hover:text-neutral-950 hover:border-neutral-300/70 dark:border-neutral-800/70 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-700/70 dark:hover:bg-neutral-800 dark:hover:text-white h-10 px-4 py-2 rounded-lg w-auto relative">
                  <FcGoogle className="w-4 h-4 mr-1.5" /> Sign in with Google
                </button>
                <button onClick={() => handleOAuth('oauth_github')} type="button" className="inline-flex items-center justify-center gap-1 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.99] bg-white border border-neutral-200/70 hover:bg-neutral-50 hover:text-neutral-950 hover:border-neutral-300/70 dark:border-neutral-800/70 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-700/70 dark:hover:bg-neutral-800 dark:hover:text-white h-10 px-4 py-2 rounded-lg w-auto relative">
                  <FaGithub className="w-4 h-4 mr-1.5" /> Sign in with Github
                </button>
              </div>

              <div className="relative flex items-center justify-center my-6">
                <span className="absolute inset-x-0 top-1/2 h-px bg-neutral-200/70 dark:bg-neutral-800/70"></span>
                <span className="relative px-3 bg-white dark:bg-neutral-900 text-[12px] font-medium uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500">or</span>
              </div>

              <div className="flex flex-col gap-2">
                <form onSubmit={handleEmailSubmit} className="w-full space-y-4">
                  <div className="text-sm focus-within:ring-1 focus-within:ring-blue-500 border border-neutral-200/70 bg-white text-neutral-900 hover:border-neutral-300/70 dark:border-neutral-800/70 dark:bg-neutral-900/50 dark:text-neutral-100 dark:hover:border-neutral-700/70 h-10 rounded-lg px-1 flex items-center w-full">
                    <input required type="email" placeholder="ben@acme.co" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} className="h-full w-full bg-transparent pl-3 pr-2 focus:outline-none text-base md:text-sm disabled:cursor-not-allowed placeholder:opacity-60" />
                  </div>
                  <div className="text-sm focus-within:ring-1 focus-within:ring-blue-500 border border-neutral-200/70 bg-white text-neutral-900 hover:border-neutral-300/70 dark:border-neutral-800/70 dark:bg-neutral-900/50 dark:text-neutral-100 dark:hover:border-neutral-700/70 h-10 rounded-lg px-1 flex items-center w-full">
                    <input required type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} className="h-full w-full bg-transparent pl-3 pr-2 focus:outline-none text-base md:text-sm disabled:cursor-not-allowed placeholder:opacity-60" />
                  </div>
                  {errorMsg && (
                    <div className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 p-2.5 rounded-lg border border-red-200/50 dark:border-red-800/50">
                      {errorMsg}
                    </div>
                  )}
                  <div id="clerk-captcha"></div>
                  <button disabled={isLoading} type="submit" className="inline-flex items-center justify-center gap-1 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.99] border border-transparent bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 font-medium shadow-[0_0px_1px_rgba(0,0,0,0.45),0_2px_3px_rgba(0,0,0,0.05),0_0px_1px_rgba(0,0,0,0.07)] h-10 px-4 py-2 rounded-lg w-full relative">
                    {isLoading ? "Signing in..." : "Sign in"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
        <p className="relative z-10 text-[12px] text-neutral-400 dark:text-neutral-500 mt-6">
          © 2026 Kyte · <Link className="hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors" href="/privacy">Privacy</Link> · <Link className="hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors" href="/terms">Terms</Link>
        </p>
      </div>
    </div>
  )
}
