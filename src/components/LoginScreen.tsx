import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Sparkles, Video, ArrowRight, Chrome, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginScreenProps {
  onLoginSuccess?: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      onLoginSuccess?.();
    } catch (err: any) {
      console.error('Login failed:', err);
      // Give meaningful, polite troubleshooting instructions
      setError(
        err.code === 'auth/popup-closed-by-user'
          ? 'The login popup was closed. Please try again to sign in.'
          : err.message || 'An unexpected error occurred during sign-in.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login-container" className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center relative overflow-hidden px-4">
      {/* Visual glowing backgrounds resembling TikTok visual branding */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full filter blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-500/10 rounded-full filter blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-md bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-8 shadow-2xl relative z-10"
      >
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-cyan-500 via-slate-950 to-fuchsia-500 rounded-2xl flex items-center justify-center p-3 shadow-lg border border-slate-700/50 mb-4">
            <Video className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-white to-fuchsia-400 bg-clip-text text-transparent">
            TikTok Shorts Creator
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            AI-driven high-engagement clip extractor and captioning engine
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 gap-3 flex items-start">
            <Sparkles className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-400 leading-relaxed">
              Accepts long-form YouTube URLs, extracts high-virality hooks with Gemini 3.5 Flash, and creates perfect 9:16 portrait captioned shorts.
            </div>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl p-3 text-center">
              {error}
            </div>
          )}

          <button
            id="google-login-btn"
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-cyan-500/20"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Chrome className="w-4 h-4" />
                <span>Continue with Google Account</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800 flex justify-center items-center gap-2 text-slate-500 text-[11px]">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Secure OAuth authentication powered by Firebase</span>
        </div>
      </motion.div>
    </div>
  );
}
