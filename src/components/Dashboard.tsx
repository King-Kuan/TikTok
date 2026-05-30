import { useState, useEffect, MouseEvent } from 'react';
import { collection, query, where, onSnapshot, getDocs, doc, deleteDoc, orderBy } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { ShortsJob, TikTokClip } from '../types';
import { Plus, Link, Timer, Film, Edit, Sparkles, Youtube, CheckCircle2, AlertTriangle, LogOut, Check, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardProps {
  onSelectClip: (clip: TikTokClip, youtubeUrl: string) => void;
}

// Preset example links representing viral content to let authors explore instantly
const PRESET_EXAMPLES = [
  {
    title: "How Space Travel Works",
    url: "https://www.youtube.com/watch?v=F3zLg09NeeQ",
    channel: "CosmicScience"
  },
  {
    title: "The Future of Quantum Computing",
    url: "https://www.youtube.com/watch?v=R2_A9-yA-Fw",
    channel: "TechPioneers"
  }
];

export default function Dashboard({ onSelectClip }: DashboardProps) {
  const [user, setUser] = useState(auth.currentUser);
  const [jobs, setJobs] = useState<ShortsJob[]>([]);
  const [clipsByJob, setClipsByJob] = useState<{ [jobId: string]: TikTokClip[] }>({});
  
  // Submission forms
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Selected job filter state
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((u) => {
      setUser(u);
    });
    return () => unsubAuth();
  }, []);

  // Set up Firebase Real-time synchronization to track background analysis jobs
  useEffect(() => {
    if (!user) return;

    const jobsQuery = query(
      collection(db, 'jobs'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(jobsQuery, (snapshot) => {
      const parsedJobs: ShortsJob[] = [];
      snapshot.forEach((docSnap) => {
        parsedJobs.push({ id: docSnap.id, ...docSnap.data() } as ShortsJob);
      });
      
      // Sort in memory safely to bypass manual index wait-times
      parsedJobs.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setJobs(parsedJobs);
      
      if (parsedJobs.length > 0 && !activeJobId) {
        setActiveJobId(parsedJobs[0].id);
      }
    }, (error) => {
      console.error("Firestore listening error:", error);
    });

    return () => unsubscribe();
  }, [user, activeJobId]);

  // Synchronize Sub-clips subcollection whenever active job changes
  useEffect(() => {
    if (!activeJobId) return;

    const clipsQuery = collection(db, 'jobs', activeJobId, 'clips');
    
    const unsubscribe = onSnapshot(clipsQuery, (snapshot) => {
      const parsedClips: TikTokClip[] = [];
      snapshot.forEach((docSnap) => {
        parsedClips.push({ id: docSnap.id, ...docSnap.data() } as TikTokClip);
      });
      
      // Order clips simply based on discovery sequential order
      parsedClips.sort((a,b) => {
        const indexA = parseInt(a.id.split('_')[1]) || 0;
        const indexB = parseInt(b.id.split('_')[1]) || 0;
        return indexA - indexB;
      });

      setClipsByJob(prev => ({ ...prev, [activeJobId]: parsedClips }));
    });

    return () => unsubscribe();
  }, [activeJobId]);

  const handleProcessSubmit = async (urlStr: string) => {
    if (!user) return;
    setLoading(true);
    setFormError(null);

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtubeUrl: urlStr,
          userId: user.uid
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Request submission returned error status.');
      }

      setYoutubeUrl('');
      if (data.jobId) {
        setActiveJobId(data.jobId);
      }
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'An error occurred triggering the AI pipeline.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteJob = async (jobId: string, e: MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'jobs', jobId));
      if (activeJobId === jobId) {
        setActiveJobId(null);
      }
    } catch (err) {
      console.error("Failed to delete job profile:", err);
    }
  };

  const handleLogout = () => {
    auth.signOut();
  };

  return (
    <div id="dashboard-container" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-cyan-500 via-slate-950 to-fuchsia-500 rounded-xl p-1.5 border border-slate-700">
            <Youtube className="w-full h-full text-white" />
          </div>
          <div>
            <h1 className="text-md font-bold text-white tracking-tight flex items-center gap-2">
              <span>Automatic Video Shorts</span>
              <span className="bg-cyan-500/10 text-cyan-400 font-mono text-[9px] uppercase px-1.5 py-0.5 rounded tracking-widest font-extrabold">Flash 3.5</span>
            </h1>
            <p className="text-[10px] text-slate-400">Identify viral hooks & timestamps automatically</p>
          </div>
        </div>

        {/* User profile dropdown and metadata panel */}
        {user && (
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <span className="text-xs font-semibold text-slate-200 block truncate max-w-44">{user.displayName || user.email}</span>
              <span className="text-[10px] text-slate-500 font-mono">Creative Role</span>
            </div>
            {user.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className="w-9 h-9 rounded-xl border border-slate-700 object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200">
                U
              </div>
            )}
            <button
              onClick={handleLogout}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/50 cursor-pointer"
              title="Logout session"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </header>

      {/* Main Grid structure */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT PANEL: Job creation & Scanned list */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Form submission section */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full filter blur-[35px] pointer-events-none" />
            
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>Queue Long-format YouTube Video</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Gemini 3.5 Flash searches info and returns precisely 20 viral clip intervals.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); handleProcessSubmit(youtubeUrl); }} className="mt-4 space-y-3">
              <div className="relative">
                <Link className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="url"
                  placeholder="Paste YouTube Video URL..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-xs text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 placeholder-slate-600 font-mono"
                  required
                />
              </div>

              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-2 items-start text-xs text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white hover:opacity-90 flex items-center justify-center gap-2 text-xs cursor-pointer shadow-lg shadow-cyan-500/10 transition disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Auto-Generate 20 TikTok Clips</span>
                  </>
                )}
              </button>
            </form>

            {/* Quick Presets demo */}
            <div className="mt-5 pt-5 border-t border-slate-800/80">
              <span className="text-[10px] text-slate-500 uppercase font-mono tracking-widest font-extrabold">Instant Explore Presets</span>
              <div className="flex flex-col gap-2 mt-2">
                {PRESET_EXAMPLES.map((example, key) => (
                  <button
                    key={key}
                    onClick={() => handleProcessSubmit(example.url)}
                    disabled={loading}
                    className="p-2.5 bg-slate-950/40 hover:bg-slate-950 border border-slate-850/80 rounded-xl text-left flex justify-between items-center text-xs transition cursor-pointer"
                  >
                    <div>
                      <span className="font-semibold text-slate-300 block truncate">{example.title}</span>
                      <span className="text-[10px] text-fuchsia-400 font-medium tracking-tight">Channel: {example.channel}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-600 mr-1 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Scanned videos list */}
          <div className="space-y-3">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest font-mono">Scanned Video Profiles</span>
            
            <div className="space-y-2.5 max-h-[400px] overflow-y-auto">
              <AnimatePresence mode="popLayout">
                {jobs.length === 0 ? (
                  <div className="text-center p-8 border border-dashed border-slate-800 rounded-xl text-slate-600 text-xs">
                    No analyzed videos found. Paste a video above to begin!
                  </div>
                ) : (
                  jobs.map((job) => {
                    const isActive = activeJobId === job.id;
                    return (
                      <motion.div
                        key={job.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setActiveJobId(job.id)}
                        className={`p-3.5 rounded-2xl border flex gap-3.5 items-center cursor-pointer transition relative group ${
                          isActive 
                            ? 'bg-slate-900 border-cyan-500/40 relative shadow-lg' 
                            : 'bg-slate-900/60 border-slate-850 hover:bg-slate-900'
                        }`}
                      >
                        <img 
                          src={job.videoThumbnail} 
                          alt="Thumbnail" 
                          className="w-16 h-12 object-cover rounded-lg bg-slate-950"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-slate-100 truncate">{job.videoTitle}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            {job.status === 'processing' && (
                              <span className="bg-cyan-500/10 text-cyan-400 text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1">
                                <span className="w-1 h-1 bg-cyan-400 rounded-full animate-ping" />
                                <span>Analyzing Audio...</span>
                              </span>
                            )}
                            {job.status === 'completed' && (
                              <span className="bg-emerald-500/10 text-emerald-400 text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 font-bold">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Ready</span>
                              </span>
                            )}
                            {job.status === 'failed' && (
                              <span className="bg-rose-500/10 text-rose-400 text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold">
                                <span>Failed API</span>
                              </span>
                            )}
                            {job.status === 'pending' && (
                              <span className="bg-yellow-500/10 text-yellow-400 text-[9px] px-1.5 py-0.5 rounded">
                                Queued
                              </span>
                            )}
                            {job.duration > 0 && (
                              <span className="text-[10px] text-slate-450 font-mono">{(job.duration / 60).toFixed(0)} mins</span>
                            )}
                          </div>
                        </div>

                        {/* Action controls */}
                        <button
                          onClick={(e) => handleDeleteJob(job.id, e)}
                          className="p-1.5 bg-slate-950 text-slate-500 hover:text-rose-450 rounded-lg border border-slate-800 transition md:opacity-0 group-hover:opacity-100 cursor-pointer"
                          title="Remove video"
                        >
                          ✕
                        </button>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Discovered Clips & Download Studio */}
        <div className="lg:col-span-7">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl h-full flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-200">Discovered Clips Pipeline</h3>
                  <p className="text-xs text-slate-500">TikTok segments synchronized by Gemini 3.5 Flash</p>
                </div>
                {activeJobId && clipsByJob[activeJobId] && (
                  <span className="text-xs font-mono font-bold bg-cyan-500/10 text-cyan-400 px-2.5 py-1 rounded-full">
                    {clipsByJob[activeJobId].length} Discovered
                  </span>
                )}
              </div>

              {/* Grid lists of discovery clips */}
              <div className="mt-6">
                {!activeJobId ? (
                  <div className="text-center py-20 text-slate-600 text-xs">
                    Please select or paste a video first to explorer discoverable chapters.
                  </div>
                ) : (
                  <div className="space-y-3.5 max-h-[550px] overflow-y-auto pr-1">
                    {(() => {
                      const clips = clipsByJob[activeJobId] || [];
                      const targetJob = jobs.find(j => j.id === activeJobId);

                      if (targetJob?.status === 'processing') {
                        return (
                          <div className="text-center py-20 space-y-3 text-slate-500 text-xs">
                            <div className="w-8 h-8 mx-auto border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                            <p className="font-semibold text-cyan-400">Gemini 3.5 is reading video data...</p>
                            <p className="text-[10px] text-slate-600">This takes about 10-25 seconds to construct 20 clips and caption timelists.</p>
                          </div>
                        );
                      }

                      if (targetJob?.status === 'failed') {
                        return (
                          <div className="text-center py-16 space-y-2 text-slate-550 max-w-sm mx-auto">
                            <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
                            <h4 className="text-sm font-bold text-slate-300">Analysis Process Interrupted</h4>
                            <p className="text-xs text-slate-500 leading-snug">{targetJob.error || 'Server lost connection'}</p>
                          </div>
                        );
                      }

                      if (clips.length === 0) {
                        return (
                          <div className="text-center py-20 text-slate-600 text-xs text-slate-500">
                            No clip profiles fetched yet. Once job status changes, clips appear instantly.
                          </div>
                        );
                      }

                      return clips.map((clip, index) => (
                        <div
                          key={clip.id}
                          className="p-3 bg-slate-950 border border-slate-850 rounded-xl flex gap-3.5 items-center justify-between group hover:border-slate-800 transition"
                        >
                          <div className="flex gap-3 items-center min-w-0">
                            <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-xs text-cyan-400 shrink-0 select-none">
                              #{index + 1}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-slate-100 truncate">{clip.hookTitle}</h4>
                              <div className="flex items-center gap-1.5 mt-1">
                                <Timer className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {clip.start_timestamp} - {clip.end_timestamp}
                                </span>
                                {clip.status === 'rendering' && (
                                  <span className="text-[9px] bg-cyan-400/10 text-cyan-400 font-bold px-1 rounded animate-pulse">RENDERING</span>
                                )}
                                {clip.status === 'completed' && (
                                  <span className="text-[9px] bg-emerald-400/10 text-emerald-400 px-1 rounded font-bold">CHROMA LINK READY</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Editor controls trigger */}
                          <button
                            onClick={() => onSelectClip(clip, targetJob?.youtubeUrl || '')}
                            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Edit & Render</span>
                          </button>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Private workspace security tag */}
            {activeJobId && (
              <div className="pt-6 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500">
                <span>Durable cloud storage provided by Firebase Firestore</span>
                <span className="font-mono text-[9px]">ID: {activeJobId.substr(0,12)}...</span>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
