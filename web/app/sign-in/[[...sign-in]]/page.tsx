"use client";

import { useSignIn } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { GitBranch } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { FcGoogle } from "react-icons/fc";
import { FaGithub, FaReact, FaPython } from "react-icons/fa";
import { SiNextdotjs } from "react-icons/si";
import { VscSourceControl } from "react-icons/vsc";
import { getClerkErrorMessage } from '@/lib/clerk-errors'

export default function Page() {
  const { signIn } = useSignIn();
  const router = useRouter();
  const [email, setEmail] = useState('');
  useEffect(() => { document.title = "Sign In | Kyte"; }, []);
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('Signing in...');
  const [errorMsg, setErrorMsg] = useState('');

  const handleOAuth = (strategy: 'oauth_google' | 'oauth_github') => {
    if (!signIn) return;
    signIn.sso({
      strategy,
      redirectUrl: '/dashboard',
      redirectCallbackUrl: '/sso-callback',
    });
  };

  // Finish the sign-in once Clerk reports status === 'complete'. Uses client-side
  // navigation (router.push) for decorated absolute URLs returned by decorateUrl,
  // falling back to a full navigation only when Safari ITP forces an http(s) URL.
  const completeSignIn = async () => {
    await signIn!.finalize({
      navigate: async ({ decorateUrl }) => {
        const url = decorateUrl('/dashboard');
        if (url.startsWith('http')) {
          window.location.href = url;
        } else {
          router.push(url);
        }
      },
    });
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) return;
    setIsLoading(true);
    setLoadingLabel('Signing in...');
    setErrorMsg('');
    try {
      const { error } = await signIn.password({
        identifier: email,
        password
      });
      if (error) {
        setErrorMsg(getClerkErrorMessage(error, 'Invalid email or password. Please try again.'));
        return;
      }

      // Drive the sign-in forward based on the post-password status. Previously
      // only 'complete' was handled, so any account with MFA / client-trust /
      // password-reset requirements silently left the user on a dead form.
      const status = signIn.status;
      if (status === 'complete') {
        await completeSignIn();
        return; // navigating away
      }
      if (status === 'needs_second_factor' || status === 'needs_client_trust') {
        // Prepare the default second factor so the user can enter their code.
        // supportedSecondFactors tells us which strategies this account allows.
        const factors = signIn.supportedSecondFactors ?? [];
        const has = (s: string) => factors.some((f) => f.strategy === s);
        if (has('email_code') || has('phone_code')) {
          // Prefer phone_code if available, else email_code; both are verified below.
          if (has('phone_code')) {
            await signIn.mfa.sendPhoneCode();
          } else {
            await signIn.mfa.sendEmailCode();
          }
        }
        // For TOTP / backup_code there's nothing to send — the user just enters
        // a code from their authenticator app or saved backup codes.
        return;
      }
      if (status === 'needs_new_password' || status === 'needs_identifier' || status === 'needs_first_factor') {
        setErrorMsg('Additional verification is required for your account. Please reset your password or contact support.');
        return;
      }
      // Any other status: don't silently no-op — tell the user something happened.
      setErrorMsg('We couldn’t complete sign-in. Please try again.');
    } catch (err) {
      console.error(err);
      setErrorMsg(getClerkErrorMessage(err, 'Invalid email or password. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyMFA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) return;
    setIsLoading(true);
    setLoadingLabel('Verifying...');
    setErrorMsg('');
    try {
      // Verify against whichever second-factor strategy is active for this account.
      const factors = signIn.supportedSecondFactors ?? [];
      const has = (s: string) => factors.some((f) => f.strategy === s);
      let { error } = { error: null as null | unknown };
      if (has('totp')) {
        ({ error } = await signIn.mfa.verifyTOTP({ code: mfaCode }));
      } else if (has('backup_code')) {
        ({ error } = await signIn.mfa.verifyBackupCode({ code: mfaCode }));
      } else if (has('phone_code')) {
        ({ error } = await signIn.mfa.verifyPhoneCode({ code: mfaCode }));
      } else {
        ({ error } = await signIn.mfa.verifyEmailCode({ code: mfaCode }));
      }

      if (error) {
        setErrorMsg(getClerkErrorMessage(error, 'That code is incorrect. Please try again.'));
        return;
      }
      if (signIn.status === 'complete') {
        await completeSignIn();
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(getClerkErrorMessage(err, 'That code is incorrect. Please try again.'));
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
                <button onClick={() => handleOAuth('oauth_google')} type="button" disabled={isLoading} className="inline-flex items-center justify-center gap-1 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.99] bg-white border border-neutral-200/70 hover:bg-neutral-50 hover:text-neutral-950 hover:border-neutral-300/70 dark:border-neutral-800/70 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-700/70 dark:hover:bg-neutral-800 dark:hover:text-white h-10 px-4 py-2 rounded-lg w-auto relative">
                  <FcGoogle className="w-4 h-4 mr-1.5" /> Sign in with Google
                </button>
                <button onClick={() => handleOAuth('oauth_github')} type="button" disabled={isLoading} className="inline-flex items-center justify-center gap-1 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.99] bg-white border border-neutral-200/70 hover:bg-neutral-50 hover:text-neutral-950 hover:border-neutral-300/70 dark:border-neutral-800/70 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-700/70 dark:hover:bg-neutral-800 dark:hover:text-white h-10 px-4 py-2 rounded-lg w-auto relative">
                  <FaGithub className="w-4 h-4 mr-1.5" /> Sign in with Github
                </button>
              </div>

              <div className="relative flex items-center justify-center my-6">
                <span className="absolute inset-x-0 top-1/2 h-px bg-neutral-200/70 dark:bg-neutral-800/70"></span>
                <span className="relative px-3 bg-white dark:bg-neutral-900 text-[12px] font-medium uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500">or</span>
              </div>

              <div className="flex flex-col gap-2">
                {signIn && (signIn.status === 'needs_second_factor' || signIn.status === 'needs_client_trust') ? (
                  <form onSubmit={handleVerifyMFA} className="w-full space-y-4">
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center mb-2">
                      Enter the verification code sent to your device to finish signing in.
                    </p>
                    <div className="text-sm focus-within:ring-1 focus-within:ring-blue-500 border border-neutral-200/70 bg-white text-neutral-900 hover:border-neutral-300/70 dark:border-neutral-800/70 dark:bg-neutral-900/50 dark:text-neutral-100 dark:hover:border-neutral-700/70 h-10 rounded-lg px-1 flex items-center w-full">
                      <input required type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} disabled={isLoading} className="h-full w-full bg-transparent pl-3 pr-2 focus:outline-none text-base md:text-sm disabled:cursor-not-allowed tracking-widest font-mono placeholder:opacity-60" />
                    </div>
                    {errorMsg && (
                      <div className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/20 p-2.5 rounded-lg border border-red-200/50 dark:border-red-800/50">
                        {errorMsg}
                      </div>
                    )}
                    <button disabled={isLoading} type="submit" className="inline-flex items-center justify-center gap-1 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.99] border border-transparent bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 font-medium shadow-[0_0px_1px_rgba(0,0,0,0.45),0_2px_3px_rgba(0,0,0,0.05),0_0px_1px_rgba(0,0,0,0.07)] h-10 px-4 py-2 rounded-lg w-full relative">
                      {isLoading ? loadingLabel : "Verify"}
                    </button>
                  </form>
                ) : (
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
                    <button disabled={isLoading || !signIn} type="submit" className="inline-flex items-center justify-center gap-1 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.99] border border-transparent bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 font-medium shadow-[0_0px_1px_rgba(0,0,0,0.45),0_2px_3px_rgba(0,0,0,0.05),0_0px_1px_rgba(0,0,0,0.07)] h-10 px-4 py-2 rounded-lg w-full relative">
                      {isLoading ? loadingLabel : "Sign in"}
                    </button>
                  </form>
                )}
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
