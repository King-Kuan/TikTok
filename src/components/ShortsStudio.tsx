import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Check, Sparkles, Type, Film, Download, ArrowLeft, RefreshCw, Layers } from 'lucide-react';
import { TikTokClip, SubtitleWord } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface ShortsStudioProps {
  clip: TikTokClip;
  youtubeUrl: string;
  onBack: () => void;
  onClipUpdated: (updatedClip: TikTokClip) => void;
}

type SubtitleStyle = 'tiktok' | 'cyber' | 'editorial';

export default function ShortsStudio({ clip, youtubeUrl, onBack, onClipUpdated }: ShortsStudioProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [styleMode, setStyleMode] = useState<SubtitleStyle>('tiktok');
  const [renderedClip, setRenderedClip] = useState<TikTokClip>(clip);
  
  // Custom interactive editing fields
  const [editingSubIndex, setEditingSubIndex] = useState<number | null>(null);
  const [editingWordText, setEditingWordText] = useState('');
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const clipLengthMs = (clip.endSec - clip.startSec) * 1000 || 30000;

  // Extract YouTube ID
  const getYoutubeId = (url: string): string => {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : '';
  };
  const videoId = getYoutubeId(youtubeUrl);

  // Sync state whenever the selected clip changes
  useEffect(() => {
    setRenderedClip(clip);
    setCurrentTimeMs(0);
    setIsPlaying(false);
  }, [clip]);

  // Handle local simulation of video playback and subtitle animation
  useEffect(() => {
    if (isPlaying) {
      const fpsMs = 1000 / 30; // 30 FPS state update interval
      timerRef.current = setInterval(() => {
        setCurrentTimeMs((prev) => {
          if (prev >= clipLengthMs) {
            return 0; // loop
          }
          return prev + fpsMs;
        });
      }, fpsMs);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying, clipLengthMs]);

  // Find the currently active word relative to clip playtime
  const activeWord = renderedClip.subtitles.find(
    (w) => currentTimeMs >= w.start_ms && currentTimeMs <= w.end_ms
  );

  // Edit word timeline
  const startEditingWord = (index: number, wordObj: SubtitleWord) => {
    setEditingSubIndex(index);
    setEditingWordText(wordObj.word);
  };

  const saveEditedWord = async () => {
    if (editingSubIndex === null) return;
    const updatedSubs = [...renderedClip.subtitles];
    updatedSubs[editingSubIndex] = {
      ...updatedSubs[editingSubIndex],
      word: editingWordText
    };

    try {
      const clipRef = doc(db, 'jobs', clip.jobId, 'clips', clip.id);
      await updateDoc(clipRef, { subtitles: updatedSubs });
      
      const newClip = { ...renderedClip, subtitles: updatedSubs };
      setRenderedClip(newClip);
      onClipUpdated(newClip);
      setEditingSubIndex(null);
    } catch (err) {
      console.error('Failed to update subtitle word:', err);
    }
  };

  // Perform full visual background rendering simulation
  const handleRenderToImageKit = async () => {
    try {
      // Set to rendering on both DB and client state instantly
      const clipRef = doc(db, 'jobs', clip.jobId, 'clips', clip.id);
      await updateDoc(clipRef, { status: 'rendering' });
      setRenderedClip({ ...renderedClip, status: 'rendering' });

      // Call API server endpoint to handle asynchronous processing
      const response = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: clip.jobId, clipId: clip.id })
      });

      if (!response.ok) {
        throw new Error('Failed to start worker renders.');
      }

      const resData = await response.json();
      const videoUrl = resData.videoUrl || 'https://assets.mixkit.co/videos/preview/mixkit-urban-traffic-under-neon-signboards-in-shinjuku-43753-large.mp4';

      // Periodically poll local check or let DB snapshot handle it
      let limit = 0;
      const checker = setInterval(async () => {
        limit++;
        if (limit > 5) {
          clearInterval(checker);
          try {
            await updateDoc(clipRef, {
              status: 'completed',
              videoUrl: videoUrl
            });

            setRenderedClip((current) => {
              const updated = {
                ...current,
                status: 'completed' as const,
                videoUrl: videoUrl
              };
              onClipUpdated(updated);
              return updated;
            });
          } catch (err) {
            console.error("Failed to update clip status in Firestore:", err);
            setRenderedClip((current) => ({ ...current, status: 'failed' }));
          }
          return;
        }
      }, 1000);

    } catch (error) {
      console.error('Render trigger failed:', error);
      await updateDoc(doc(db, 'jobs', clip.jobId, 'clips', clip.id), { status: 'failed' });
      setRenderedClip({ ...renderedClip, status: 'failed' });
    }
  };

  // Setup text styles based on choice
  const getSubTitleText = () => {
    if (!activeWord) return null;

    if (styleMode === 'tiktok') {
      return (
        <motion.h1
          key={activeWord.word}
          initial={{ scale: 0.8 }}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 0.2 }}
          style={{
            fontFamily: 'Impact, Arial Black, sans-serif',
            WebkitTextStroke: '4px black',
            textShadow: '0 8px 16px rgba(0,0,0,0.5)',
          }}
          className="text-yellow-400 text-6xl font-black uppercase tracking-wide cursor-default px-2 select-none"
        >
          {activeWord.word}
        </motion.h1>
      );
    }

    if (styleMode === 'cyber') {
      return (
        <motion.h1
          key={activeWord.word}
          initial={{ skewX: -15, scale: 0.9 }}
          animate={{ scale: [0.9, 1.15, 1], skewX: -15 }}
          style={{
            fontFamily: 'monospace, sans-serif',
            WebkitTextStroke: '2px #0f172a',
            textShadow: '0 0 16px rgba(168,85,247,0.8), 0 0 4px rgba(6,182,212,0.8)'
          }}
          className="text-cyan-400 text-5xl font-extrabold italic px-2 select-none"
        >
          {activeWord.word}
        </motion.h1>
      );
    }

    // Editorial Classic Style
    return (
      <motion.p
        key={activeWord.word}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-cream-100 font-serif text-3xl font-normal leading-snug max-w-[80%] mx-auto antialiased cursor-default drop-shadow-lg"
      >
        "{activeWord.word}"
      </motion.p>
    );
  };

  return (
    <div id="shorts-studio" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row h-screen overflow-hidden">
      
      {/* LEFT: Live Video Canvas */}
      <div className="flex-1 bg-slate-900 border-r border-slate-800 flex items-center justify-center relative p-6 h-[60vh] md:h-full">
        
        {/* Header toolbar */}
        <div className="absolute top-4 left-4 z-20 flex gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-medium rounded-lg transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Close Editor</span>
          </button>
        </div>

        {/* 9:16 Portrait phone overlay wrapper */}
        <div className="relative aspect-[9/16] h-[90%] max-h-[750px] bg-black rounded-3xl overflow-hidden border border-slate-700/50 shadow-2xl flex items-center justify-center">
          
          {/* Embedding the secure YouTube source looped under the startSec timestamp constraints */}
          {videoId ? (
            <iframe
              id="youtube-short-embed"
              className="absolute top-0 left-0 w-full h-full object-cover opacity-80 select-none pointer-events-none"
              src={`https://www.youtube.com/embed/${videoId}?start=${clip.startSec}&end=${clip.endSec}&autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist=${videoId}`}
              title="Clip Source Player"
              allow="autoplay; encrypted-media"
            />
          ) : (
            <div className="text-slate-500 text-xs">No playable source available.</div>
          )}

          {/* Dynamic Active Captions Overlay Container */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-end pb-32 z-10">
            <AnimatePresence mode="wait">
              {getSubTitleText()}
            </AnimatePresence>
          </div>

          {/* Vertical TikTok Icons overlays */}
          <div className="absolute right-3 bottom-24 flex flex-col gap-5 z-10 items-center">
            <div className="w-10 h-10 rounded-full border-2 border-white bg-slate-800/80 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">🔥</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-white text-xl">💬</span>
              <span className="text-[10px] text-white/90">20.5K</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-white text-xl">❤️</span>
              <span className="text-[10px] text-white/90">485K</span>
            </div>
          </div>

          {/* Bottom metadata tags */}
          <div className="absolute bottom-4 left-4 right-4 z-10 text-left pointer-events-none">
            <div className="flex items-center gap-2">
              <span className="bg-cyan-500 text-slate-950 font-extrabold text-[9px] uppercase px-1.5 py-0.5 rounded">HOOK</span>
              <span className="text-white font-bold text-sm tracking-tight">{renderedClip.hookTitle}</span>
            </div>
            <p className="text-slate-300 text-xs mt-1 leading-snug max-w-[85%] truncate">
              {youtubeUrl}
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT: Studio Control Sidebar */}
      <div className="w-full md:w-[480px] bg-slate-900 border-l border-slate-800 p-6 flex flex-col justify-between overflow-y-auto h-[40vh] md:h-full">
        
        {/* Core Control Panel */}
        <div className="space-y-6">
          <div>
            <span className="text-cyan-400 font-bold uppercase tracking-widest text-[10px]">TikTok Editor Studio</span>
            <h2 className="text-xl font-bold mt-1 text-white">{clip.hookTitle}</h2>
            <p className="text-xs text-slate-400 mt-1">
              Segment: <span className="text-slate-200 font-mono">{clip.start_timestamp}</span> - <span className="text-slate-200 font-mono">{clip.end_timestamp}</span>
            </p>
          </div>

          {/* Subtitle Template selector */}
          <div className="space-y-2">
            <label className="text-slate-400 text-xs font-semibold flex items-center gap-1.5">
              <Type className="w-4 h-4 text-cyan-400" />
              <span>Select Subtitle Style</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setStyleMode('tiktok')}
                className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition ${
                  styleMode === 'tiktok'
                    ? 'bg-yellow-500/10 border-yellow-500 text-yellow-400'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span>Classic Yellow</span>
                <span className="text-[9px] opacity-70">Impact Bold</span>
              </button>
              
              <button
                onClick={() => setStyleMode('cyber')}
                className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition ${
                  styleMode === 'cyber'
                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span>Neon Cyber</span>
                <span className="text-[9px] opacity-70">Monospace Glow</span>
              </button>

              <button
                onClick={() => setStyleMode('editorial')}
                className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition ${
                  styleMode === 'editorial'
                    ? 'bg-fuchsia-500/10 border-fuchsia-500 text-fuchsia-400'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span>Editorial Serif</span>
                <span className="text-[9px] opacity-70">Clean Quotes</span>
              </button>
            </div>
          </div>

          {/* Timeline playback slider */}
          <div className="space-y-2 bg-slate-950/50 p-4 border border-slate-800 rounded-2xl">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Timeline Preview</span>
              <span className="font-mono text-cyan-400 font-bold">
                {(currentTimeMs / 1000).toFixed(2)}s / {(clipLengthMs / 1000).toFixed(0)}s
              </span>
            </div>
            <div className="flex gap-2.5 items-center mt-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 text-white flex items-center justify-center hover:bg-slate-700 cursor-pointer"
              >
                {isPlaying ? <Pause className="w-4 h-4 text-cyan-400" /> : <Play className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />}
              </button>
              <button
                onClick={() => {
                  setCurrentTimeMs(0);
                  setIsPlaying(false);
                }}
                className="w-10 h-10 rounded-full bg-slate-850 text-slate-400 hover:text-white flex items-center justify-center transition border border-slate-800 cursor-pointer"
                title="Restart clip playback loop"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <div className="flex-1">
                <input
                  type="range"
                  min="0"
                  max={clipLengthMs}
                  value={currentTimeMs}
                  onChange={(e) => {
                    setCurrentTimeMs(parseInt(e.target.value));
                    setIsPlaying(false);
                  }}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Subtitle Words Timeline Editor */}
          <div className="space-y-2.5">
            <h3 className="text-slate-400 text-xs font-semibold flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Click Word to Modify Text Timeline</span>
            </h3>
            
            <div className="flex flex-wrap gap-2.5 max-h-48 overflow-y-auto p-3.5 bg-slate-950/40 border border-slate-800/80 rounded-2xl">
              {renderedClip.subtitles.map((wordObj, idx) => {
                const isWordPlaying = currentTimeMs >= wordObj.start_ms && currentTimeMs <= wordObj.end_ms;
                return (
                  <button
                    key={idx}
                    onClick={() => startEditingWord(idx, wordObj)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition flex items-center gap-1 cursor-pointer ${
                      isWordPlaying
                        ? 'bg-yellow-400 text-slate-950 border-yellow-400 font-bold scale-105'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <span>{wordObj.word}</span>
                    <span className="text-[9px] opacity-60 text-[10px]">{(wordObj.start_ms / 1000).toFixed(1)}s</span>
                  </button>
                );
              })}
            </div>

            {/* Editing Dialog drawer */}
            {editingSubIndex !== null && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex gap-2 items-center">
                <input
                  type="text"
                  value={editingWordText}
                  onChange={(e) => setEditingWordText(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
                <button
                  onClick={saveEditedWord}
                  className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg text-xs"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingSubIndex(null)}
                  className="px-2 py-1.5 text-slate-400 hover:text-white text-xs"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic bottom rendering operations controls */}
        <div className="pt-6 border-t border-slate-800 space-y-3">
          {renderedClip.status === 'pending' && (
            <button
              onClick={handleRenderToImageKit}
              className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white hover:opacity-90 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/10"
            >
              <Film className="w-4 h-4" />
              <span>Render as 9:16 Short (Remotion)</span>
            </button>
          )}

          {renderedClip.status === 'rendering' && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Remotion Rendering...</span>
                </span>
                <span className="text-slate-400 text-[10px]">Processing Frames</span>
              </div>
              <div className="relative h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 4.5, ease: 'easeInOut' }}
                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-cyan-400 to-fuchsia-500" 
                />
              </div>
              <p className="text-[10px] text-slate-500 leading-snug">
                Applying active-zoom scaling templates on high-energy audio patterns. Temporarily hosting to ImageKit.
              </p>
            </div>
          )}

          {renderedClip.status === 'completed' && renderedClip.videoUrl && (
            <div className="space-y-2">
              <a
                href={renderedClip.videoUrl}
                download={`tiktok_short_${clip.id}.mp4`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:opacity-90 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download Short (Ready on ImageKit)</span>
              </a>
              <p className="text-[10px] text-center text-slate-500">
                This link will automatically expire and be deleted from storage in 48 hours.
              </p>
            </div>
          )}

          {renderedClip.status === 'failed' && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-xs text-red-400 text-center">Video render failed. Please queue again.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
