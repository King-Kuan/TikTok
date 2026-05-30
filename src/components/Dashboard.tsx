import { useState, useEffect, MouseEvent } from 'react';
import { collection, query, where, onSnapshot, getDocs, doc, deleteDoc, orderBy, setDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
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
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Selected job filter state
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Loaded video preview workspace states (Step 1)
  const [previewData, setPreviewData] = useState<{
    url: string;
    videoId: string;
    title: string;
    thumbnail: string;
    transcript: string;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Helper to extract YouTube video ID
  const getHostYoutubeId = (url: string): string => {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : '';
  };

  const handleLoadVideo = async (urlStr: string) => {
    if (!urlStr) {
      setFormError('Please enter a YouTube video URL first.');
      return;
    }
    setLoadingPreview(true);
    setFormError(null);
    setPreviewData(null);
    setActiveJobId(null);

    try {
      const response = await fetch('/api/load-video-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl: urlStr })
      });

      const contentType = response.headers.get('content-type') || '';
      let data: any = {};

      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        throw new Error('Server returned an invalid non-JSON metadata response.');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch video details.');
      }

      setPreviewData({
        url: urlStr,
        videoId: data.videoId || '',
        title: data.title || 'YouTube Video Preview',
        thumbnail: data.thumbnail || '',
        transcript: data.transcript || ''
      });
      setTranscript(data.transcript || '');
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Could not load YouTube video metadata and transcripts.');
    } finally {
      setLoadingPreview(false);
    }
  };

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
      handleFirestoreError(error, OperationType.LIST, 'jobs');
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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `jobs/${activeJobId}/clips`);
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
          userId: user.uid,
          transcript: transcript
        })
      });

      // Safely inspect content-type of the response before parsing as JSON
      const contentType = response.headers.get('content-type') || '';
      let data: any = {};

      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const textResponse = await response.text();
        // Extract any potential readable text block from the HTML if possible
        const cleanSnippet = textResponse
          .replace(/<[^>]*>/g, ' ') // Strip HTML tags to extract raw message
          .replace(/\s+/g, ' ')
          .trim();
        const snippet = cleanSnippet.length > 180 
          ? cleanSnippet.substring(0, 180) + '...' 
          : cleanSnippet || 'Empty response body';
          
        throw new Error(`Server returned an HTML/text error page (Status: ${response.status}). If the application server has not finished starting or is missing API keys, this may be a gateway or error page. Details: "${snippet}"`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Request submission returned error status.');
      }

      const jobId = data.jobId;
      if (!jobId) {
        throw new Error('Analysis completed but no job ID was returned.');
      }

      // Helper to turn HH:MM:SS to seconds
      const parseTimeToSec = (ts: string): number => {
        const parts = ts.split(':').map(Number);
        if (parts.length === 3) {
          return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
        return 0;
      };

      const jobDoc = {
        id: jobId,
        userId: user.uid,
        youtubeUrl: urlStr,
        status: 'completed',
        videoTitle: data.videoTitle || 'Scanned Video',
        videoThumbnail: data.videoThumbnail,
        duration: data.duration || 0,
        transcript: transcript || data.transcript || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 1. Create Job document in Firestore
      try {
        await setDoc(doc(db, 'jobs', jobId), jobDoc);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `jobs/${jobId}`);
      }

      // 2. Create sub-clips in Firestore
      const clipsList = data.clips || [];
      for (let i = 0; i < clipsList.length; i++) {
        const targetClip = clipsList[i];
        const clipId = `clip_${i + 1}`;
        const startSec = parseTimeToSec(targetClip.start_timestamp);
        const endSec = parseTimeToSec(targetClip.end_timestamp) || (startSec + 45);

        const dbClipDoc = {
          id: clipId,
          jobId,
          hookTitle: targetClip.hookTitle || `Viral Chapter #${i + 1}`,
          start_timestamp: targetClip.start_timestamp,
          end_timestamp: targetClip.end_timestamp,
          startSec,
          endSec,
          videoUrl: null,
          status: 'pending',
          subtitles: targetClip.subtitles || [],
          createdAt: new Date().toISOString()
        };

        try {
          await setDoc(doc(db, 'jobs', jobId, 'clips', clipId), dbClipDoc);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `jobs/${jobId}/clips/${clipId}`);
        }
      }

      setYoutubeUrl('');
      setTranscript('');
      setPreviewData(null);
      setActiveJobId(jobId);
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
      handleFirestoreError(err, OperationType.DELETE, `jobs/${jobId}`);
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
              <span>Step 1: Get Video & Captions</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Load your YouTube video and retrieve/paste its spoken captions for AI targeting.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); handleLoadVideo(youtubeUrl); }} className="mt-4 space-y-3">
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
                disabled={loading || loadingPreview}
                className="w-full py-3 rounded-xl font-bold bg-slate-850 hover:bg-slate-800 border border-slate-700 text-white flex items-center justify-center gap-2 text-xs cursor-pointer shadow-lg transition disabled:opacity-50"
              >
                {loadingPreview ? (
                  <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Youtube className="w-4 h-4 text-red-500" />
                    <span>Load Video & Transcript Draft</span>
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
                    onClick={() => handleLoadVideo(example.url)}
                    disabled={loading || loadingPreview}
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
        </div>        {/* RIGHT PANEL: Discovered Clips & Download Studio OR Preview Sandbox Workspace */}
        <div className="lg:col-span-7">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl h-full flex flex-col justify-between min-h-[500px]">
            
            {/* 1. Loading state of Video metadata/transcripts stream */}
            {loadingPreview ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-10 space-y-4">
                <div id="loading-spinner-preview" className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <div>
                  <h4 className="text-sm font-bold text-slate-200">Loading YouTube Source & Captions...</h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1 leading-snug">
                    Querying video endpoints to secure duration, stream bounds, and auto-loading a realistic narration transcript draft.
                  </p>
                </div>
              </div>
            ) : loading ? (
              /* 2. Processing long-form audio/captions matching clips */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-10 space-y-4">
                <div id="analyzing-progress-loader" className="w-16 h-16 rounded-full bg-slate-950 border border-slate-800/80 flex items-center justify-center relative shadow-lg">
                  <div className="absolute inset-0 border-2 border-dashed border-fuchsia-400 rounded-full animate-spin" />
                  <Sparkles className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200">Triggering Intelligent AI Scanner...</h4>
                  <p className="text-xs text-cyan-400 font-mono mt-1 font-semibold">Gemini 3.5 Flash is reading transcript context</p>
                  <p className="text-[10px] text-slate-500 max-w-xs mt-2 leading-relaxed">
                    Analyzing line-by-line script hooks to index exactly 20 hot, high-engagement TikTok clips. Please wait 10-25 seconds...
                  </p>
                </div>
              </div>
            ) : previewData ? (
              /* 3. STEP 2 WORKSPACE: Preview Video & Read/Edit Loaded Transcripts */
              <div className="flex-1 flex flex-col justify-between h-full space-y-6">
                <div>
                  <div className="flex justify-between items-center pb-3.5 border-b border-slate-800">
                    <div>
                      <span className="text-[9px] bg-red-500/10 text-red-500 font-extrabold font-mono uppercase px-2 py-0.5 rounded">Loaded Workspace</span>
                      <h3 className="text-sm font-bold text-slate-200 mt-1 truncate max-w-[320px]">{previewData.title}</h3>
                    </div>
                    <button
                      onClick={() => setPreviewData(null)}
                      className="text-xs text-slate-500 hover:text-white transition font-semibold"
                    >
                      Reset Workspace
                    </button>
                  </div>

                  {/* LIVE YouTube Video Player Sandbox */}
                  <div className="mt-4">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1.5 font-mono">Live Video preview</span>
                    <div className="aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 shadow-inner relative">
                      {previewData.videoId ? (
                        <iframe
                          id="video-player-preview-iframe"
                          className="w-full h-full"
                          src={`https://www.youtube.com/embed/${previewData.videoId}`}
                          title="YouTube Video Preview Player"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs text-center p-6">
                          Embedded video preview stream could not be requested for this URL context.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sandbox Transcript Work Area */}
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider font-mono">Review & Edit Loaded Transcripts</span>
                      <span className="text-[10px] text-slate-500 font-mono">Input word length: {transcript.split(/\s+/).length} words</span>
                    </div>
                    <textarea
                      id="loaded-transcript-textarea"
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                      className="w-full h-44 bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 placeholder-slate-600 font-mono resize-none leading-relaxed"
                      placeholder="Paste details or modify the loaded script transcript outline here..."
                    />
                  </div>
                </div>

                {/* Final Trigger Call To Action Widget */}
                <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-950/40 border border-cyan-800/40 flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-white">Step 2: Trigger AI Trimming & Moment Scanner</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                        Ready to extract TikTok clips! High-energy audio scans locate precisely 20 high-engagement moments based on your transcript.
                      </p>
                      <button
                        onClick={() => handleProcessSubmit(previewData.url)}
                        className="mt-3 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:opacity-90 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-cyan-500/10 cursor-pointer"
                      >
                        <span>Trigger Intelligent AI Moment Scanner</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeJobId ? (
              /* 4. COMPLETED OR SCANNED JOB PIPELINE VIEW & COMPACT LAYOUT */
              <div>
                {(() => {
                  const targetJob = jobs.find(j => j.id === activeJobId);
                  const clips = clipsByJob[activeJobId] || [];
                  const vId = targetJob ? getHostYoutubeId(targetJob.youtubeUrl) : '';

                  return (
                    <div className="space-y-5">
                      
                      {/* Job Header Info bar */}
                      <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                        <div className="min-w-0">
                          <span className="text-[9px] bg-cyan-500/10 text-cyan-400 font-extrabold font-mono uppercase px-2 py-0.5 rounded">Scanned Pipeline</span>
                          <h3 className="text-sm font-bold text-slate-100 mt-1 truncate max-w-[340px]">{targetJob?.videoTitle || 'Scanned Video'}</h3>
                        </div>
                        {clips.length > 0 && (
                          <span className="text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full whitespace-nowrap">
                            {clips.length} Discovered Clips
                          </span>
                        )}
                      </div>

                      {/* COMPACT DETAILED REVIEW LAYER: Collapsible video player & transcript of historical scan */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/40 p-3.5 border border-slate-850 rounded-2xl">
                        
                        {/* Live Player Sandbox */}
                        <div>
                          <span className="text-[9px] text-slate-450 uppercase font-bold tracking-wider block mb-1 font-mono">Reference Video player</span>
                          <div className="aspect-video bg-black rounded-lg overflow-hidden border border-slate-850 relative">
                            {vId ? (
                              <iframe
                                id="historical-player-embed-iframe"
                                className="w-full h-full"
                                src={`https://www.youtube.com/embed/${vId}`}
                                title="YouTube Video Preview Player"
                                allow="accelerometer; clipboard-write; encrypted-media; gyroscope"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs">No preview video ID</div>
                            )}
                          </div>
                        </div>

                        {/* Stored Transcript */}
                        <div className="flex flex-col h-[105px] overflow-hidden">
                          <span className="text-[9px] text-slate-450 uppercase font-bold tracking-wider block mb-1 font-mono">Synchronized Transcripts</span>
                          <div className="flex-1 overflow-y-auto bg-slate-950 p-2 rounded-lg border border-slate-900 text-[10px] text-slate-400 font-mono leading-relaxed max-h-[85px] scrollbar-thin">
                            {targetJob?.transcript || "Transcript detail metadata matches other active sub-word lists."}
                          </div>
                        </div>
                      </div>

                      {/* TikTok segments list display */}
                      <div className="space-y-3">
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest font-mono">Segmented TikTok Clip Timestamps</span>

                        {targetJob?.status === 'processing' ? (
                          <div className="text-center py-20 space-y-3 text-slate-500 text-xs">
                            <div className="w-8 h-8 mx-auto border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                            <p className="font-semibold text-cyan-400">Gemini 3.5 is reading video data...</p>
                            <p className="text-[10px] text-slate-600">This takes about 10-25 seconds to construct 20 clips and captions timelists.</p>
                          </div>
                        ) : targetJob?.status === 'failed' ? (
                          <div className="text-center py-16 space-y-2 text-slate-550 max-w-sm mx-auto">
                            <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" strokeWidth={1.5} />
                            <h4 className="text-sm font-bold text-slate-300">Analysis Process Interrupted</h4>
                            <p className="text-xs text-slate-500 leading-snug">{targetJob.error || 'Server lost connection'}</p>
                          </div>
                        ) : clips.length === 0 ? (
                          <div className="text-center py-20 text-slate-600 text-xs">
                            No clip profiles fetched yet. Once job status changes, clips appear instantly.
                          </div>
                        ) : (
                          <div className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1">
                            {clips.map((clip, index) => (
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
                                      <Timer className="w-3.5 h-3.5 text-slate-500 font-bold" />
                                      <span className="text-[10px] text-slate-450 font-mono">
                                        {clip.start_timestamp} - {clip.end_timestamp}
                                      </span>
                                      {clip.status === 'rendering' && (
                                        <span className="text-[9px] bg-cyan-450/10 text-cyan-400 font-bold px-1.5 py-0.5 rounded animate-pulse">RENDERING</span>
                                      )}
                                      {clip.status === 'completed' && (
                                        <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded">CHROMA READY</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <button
                                  onClick={() => onSelectClip(clip, targetJob?.youtubeUrl || '')}
                                  className="px-3 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  <span>Edit & Render</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              /* 5. DEFAULT IDLE SCREEN */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-6">
                <div id="welcome-globe-icon" className="w-20 h-20 rounded-3xl bg-slate-950 border border-slate-800 flex items-center justify-center text-3xl shadow-xl shadow-cyan-500/5">
                  🔥
                </div>
                <div className="space-y-2 max-w-sm">
                  <h3 className="text-md font-bold text-slate-100">Video Content workspace Canvas</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Enter any YouTube URL link in the form to download properties, review playback and transcripts side-by-side, then trigger AI analysis to mark exact tiktok clip frames!
                  </p>
                </div>
              </div>
            )}

            {/* Cloud Storage and Database Tagging */}
            <div className="pt-4 border-t border-slate-850 flex justify-between items-center text-[10px] text-slate-500 mt-4 leading-none">
              <span>Cloud Storage integration: Firebase Firestore</span>
              <span>Online Integration Node</span>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
