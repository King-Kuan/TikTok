import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import ShortsStudio from './components/ShortsStudio';
import { TikTokClip } from './types';
import { Video } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authInitializing, setAuthInitializing] = useState(true);
  
  // Audio playback / Clip studio state
  const [selectedClip, setSelectedClip] = useState<TikTokClip | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  // Display a cinematic loader while Firebase checks user signature
  if (authInitializing) {
    return (
      <div id="loader" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 bg-gradient-to-tr from-cyan-500 via-slate-950 to-fuchsia-500 rounded-xl flex items-center justify-center p-2.5 shadow-lg border border-slate-700 animate-pulse">
          <Video className="w-6 h-6 text-white" />
        </div>
        <span className="text-xs font-semibold text-slate-400 font-mono tracking-wider animate-pulse">Initializing Creative Suite...</span>
      </div>
    );
  }

  // Not logged in -> Show Auth Guard Screen
  if (!user) {
    return <LoginScreen onLoginSuccess={() => setSelectedClip(null)} />;
  }

  // Active studio layout for selected clip editing operations
  if (selectedClip) {
    return (
      <ShortsStudio
        clip={selectedClip}
        youtubeUrl={youtubeUrl}
        onBack={() => {
          setSelectedClip(null);
          setYoutubeUrl('');
        }}
        onClipUpdated={(updatedClip) => {
          setSelectedClip(updatedClip);
        }}
      />
    );
  }

  // Logged-in dashboard list
  return (
    <Dashboard
      onSelectClip={(clip, url) => {
        setSelectedClip(clip);
        setYoutubeUrl(url);
      }}
    />
  );
}
