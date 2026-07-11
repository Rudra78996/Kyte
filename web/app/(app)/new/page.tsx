"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FaGithub, FaLock } from "react-icons/fa";
import { ArrowRight, Box, ChevronDown, ChevronRight, Folder, GitBranch, Globe, Search } from "lucide-react";
import { useApiRequest } from "@/hooks/use-api";

export default function NewProjectPage() {
  const [step, setStep] = useState(1);
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUsername, setGithubUsername] = useState("");
  const [repos, setRepos] = useState<any[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [searchRepo, setSearchRepo] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const apiRequest = useApiRequest();
  const router = useRouter();

  useEffect(() => {
    checkGithubConnection();
  }, []);

  const checkGithubConnection = async () => {
    try {
      setLoadingRepos(true);
      const user = await apiRequest("GET", "/auth/me");
      if (user.githubConnected) {
        setGithubConnected(true);
        setGithubUsername(user.githubUsername);
        fetchGithubRepos();
      } else {
        setLoadingRepos(false);
      }
    } catch (err) {
      setLoadingRepos(false);
    }
  };

  const fetchGithubRepos = async () => {
    try {
      const data = await apiRequest("GET", "/auth/github/repos");
      if (data && data.repos) {
        setRepos(data.repos);
      }
    } catch (err) {
      console.error("Failed to fetch repos", err);
    } finally {
      setLoadingRepos(false);
    }
  };

  const filteredRepos = repos.filter(repo => 
    repo.name.toLowerCase().includes(searchRepo.toLowerCase())
  );

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl) return;
    setProjectName(importUrl.split('/').pop() || "my-project");
    setStep(2);
  };

  const handleConnectGithub = async () => {
    try {
      const res = await apiRequest("GET", "/auth/github/connect");
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect GitHub");
    }
  };

  const handleDeploy = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiRequest("POST", "/projects", {
        name: projectName,
        repoUrl: importUrl,
      });
      router.push(`/dashboard`);
    } catch (err: any) {
      setError(err.message || "Failed to deploy project");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full min-h-screen bg-black text-neutral-200 font-sans pb-20">
      <div className="w-full h-16 flex items-center justify-center border-b border-neutral-800 bg-black">
        <h1 className="text-sm font-medium">New Project</h1>
      </div>

      <div className="w-full max-w-[800px] mt-12 flex flex-col gap-8 px-4">
        {step === 1 && (
          <>
            <h1 className="text-3xl font-semibold text-white tracking-tight text-center mb-4">Let's build something new.</h1>
            <p className="text-neutral-400 text-center mb-8 text-[15px]">To deploy a new Project, import an existing Git Repository or get started with a Template.</p>
            
            <div className="w-full border border-neutral-800 rounded-xl bg-neutral-950 overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-neutral-800">
                <h2 className="text-xl font-semibold text-white">Import Git Repository</h2>
              </div>
              <div className="p-6 flex flex-col gap-6">
                {loadingRepos ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                ) : !githubConnected ? (
                  <div className="flex flex-col items-center justify-center py-10 border border-dashed border-neutral-700 rounded-lg bg-neutral-900/30">
                    <FaGithub className="size-10 text-neutral-400 mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">Connect to GitHub</h3>
                    <p className="text-sm text-neutral-400 text-center max-w-sm mb-6">
                      Connect your GitHub account to import and deploy your private repositories directly.
                    </p>
                    <button 
                      onClick={handleConnectGithub}
                      className="bg-white text-black hover:bg-neutral-200 h-10 px-6 rounded-md text-sm font-medium transition-colors"
                    >
                      Connect GitHub
                    </button>
                    {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                      <div className="flex items-center gap-3">
                        <FaGithub className="size-5 text-white" />
                        <span className="text-sm font-medium text-white">{githubUsername}</span>
                      </div>
                      <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500" />
                        <input 
                          type="text" 
                          value={searchRepo}
                          onChange={e => setSearchRepo(e.target.value)}
                          placeholder="Search..." 
                          className="w-full h-9 bg-neutral-900 border border-neutral-800 rounded-md pl-9 pr-3 text-sm focus:outline-none focus:border-neutral-600 transition-colors"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {filteredRepos.length > 0 ? filteredRepos.map(repo => (
                        <div key={repo.id} className="flex items-center justify-between py-3 border-b border-neutral-800/50 last:border-0 hover:bg-neutral-900/50 px-2 rounded-md transition-colors">
                          <div className="flex items-center gap-3">
                            <Box className="size-4 text-neutral-400" />
                            <span className="text-sm font-medium text-neutral-200">{repo.name}</span>
                            {repo.private && <FaLock className="size-3 text-neutral-500" title="Private" />}
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-neutral-700 text-neutral-400">
                              {new Date(repo.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <button 
                            onClick={() => { setImportUrl(repo.htmlUrl); setProjectName(repo.name); setStep(2); }}
                            className="bg-neutral-800 hover:bg-neutral-700 text-white h-8 px-4 rounded-md text-xs font-medium transition-colors"
                          >
                            Import
                          </button>
                        </div>
                      )) : (
                        <p className="text-sm text-neutral-500 text-center py-4">No repositories found.</p>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-4">
                  <div className="h-[1px] bg-neutral-800 flex-1" />
                  <span className="text-xs text-neutral-500 font-medium uppercase tracking-wider">or</span>
                  <div className="h-[1px] bg-neutral-800 flex-1" />
                </div>
                
                <form onSubmit={handleImport} className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-neutral-300">Import Third-Party Git Repository</label>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500" />
                      <input 
                        type="url" 
                        required
                        value={importUrl}
                        onChange={e => setImportUrl(e.target.value)}
                        placeholder="https://github.com/user/repo" 
                        className="w-full h-10 bg-black border border-neutral-800 rounded-md pl-9 pr-3 text-sm focus:outline-none focus:border-neutral-600 transition-colors"
                      />
                    </div>
                    <button type="submit" className="bg-neutral-800 hover:bg-neutral-700 text-white h-10 px-6 rounded-md text-sm font-medium transition-colors">
                      Import
                    </button>
                  </div>
                </form>
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-6 mt-8">
              <Link href="#" className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors">Browse Templates &rarr;</Link>
              <Link href="#" className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors">Import a different Git Repository &rarr;</Link>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="w-full border border-neutral-800 rounded-xl bg-neutral-950 overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-neutral-800">
                <h2 className="text-2xl font-bold text-white mb-6">New Project</h2>
                
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-neutral-400 font-medium">Importing from GitHub</span>
                    <div className="flex items-center gap-2">
                      <FaGithub className="size-4 text-white" />
                      <span className="text-sm font-medium text-white">{importUrl.replace('https://github.com/', '') || 'Rudra78996/Kyte'}</span>
                      <GitBranch className="size-3.5 text-neutral-500 ml-2" />
                      <span className="text-sm text-neutral-400 font-mono">main</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-6 flex flex-col gap-6">
                <p className="text-sm text-neutral-300">Choose where you want to create the project and give it a name.</p>
                
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 flex flex-col gap-2">
                    <label className="text-xs font-medium text-neutral-400">Project Name</label>
                    <input 
                      type="text" 
                      value={projectName}
                      onChange={e => setProjectName(e.target.value)}
                      className="w-full h-10 bg-black border border-neutral-800 rounded-md px-3 text-sm text-white focus:outline-none focus:border-neutral-600 transition-colors"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-neutral-400">Application Preset</label>
                  <div className="relative">
                    <select className="w-full h-10 bg-black border border-neutral-800 rounded-md pl-10 pr-10 text-sm text-white appearance-none focus:outline-none focus:border-neutral-600 transition-colors">
                      <option>Other</option>
                      <option>Next.js</option>
                      <option>React</option>
                      <option>Vue</option>
                    </select>
                    <Box className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500 pointer-events-none" />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500 pointer-events-none" />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-neutral-400">Root Directory</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      disabled
                      value="./"
                      className="w-full h-10 bg-black border border-neutral-800 rounded-md px-3 text-sm text-neutral-500 cursor-not-allowed"
                    />
                    <button className="bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-white h-10 px-4 rounded-md text-sm font-medium transition-colors">
                      Edit
                    </button>
                  </div>
                </div>

                <div className="border border-neutral-800 rounded-md overflow-hidden bg-black">
                  <button className="w-full flex items-center gap-2 p-3 text-sm text-neutral-300 hover:text-white hover:bg-neutral-900/50 transition-colors">
                    <ChevronRight className="size-4" />
                    Build and Output Settings
                  </button>
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <button 
                  onClick={handleDeploy}
                  disabled={loading}
                  className="w-full bg-white text-black hover:bg-neutral-200 h-10 rounded-md text-sm font-medium transition-colors disabled:opacity-50 mt-2"
                >
                  {loading ? "Deploying..." : "Deploy"}
                </button>
              </div>
            </div>

            {/* Deployment Box */}
            <div className="w-full border border-neutral-800 rounded-xl bg-neutral-950 overflow-hidden shadow-2xl relative">
              <div className="p-6">
                <h2 className="text-xl font-bold text-white mb-4">Deployment</h2>
                <p className="text-sm text-neutral-400 mb-20">Once you're ready, start deploying to see the progress here...</p>
              </div>
              
              {/* Globe wireframe placeholder */}
              <div className="absolute bottom-[-100px] left-1/2 -translate-x-1/2 w-[800px] h-[400px] border border-neutral-800 rounded-[100%] opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.1) 0%, transparent 50%)' }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] border border-neutral-800 rounded-[100%]" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] border border-neutral-800 rounded-[100%]" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[100px] border border-neutral-800 rounded-[100%]" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-full bg-neutral-800" />
                <div className="absolute top-1/4 left-0 w-full h-[1px] bg-neutral-800" />
                <div className="absolute top-1/2 left-0 w-full h-[1px] bg-neutral-800" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
