import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Sparkles, Video, ArrowRight, Chrome, ShieldCheck, Mail, Lock, LogIn, UserPlus, Info } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginScreenProps {
  onLoginSuccess?: () => void;
}

type AuthTab = 'google' | 'email-signin' | 'email-signup';

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [activeTab, setActiveTab] = useState<AuthTab>('email-signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Email login inputs (Pre-filled with authorized creator email)
  const [email, setEmail] = useState('fridomiamovement@gmail.com');
  const [password, setPassword] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    const provider = new GoogleAuthProvider();
    try {
      const userCredential = await signInWithPopup(auth, provider);
      const userEmail = userCredential.user?.email;
      
      if (userEmail !== 'fridomiamovement@gmail.com') {
        await auth.signOut();
        throw new Error('Access Denied: This system is private and strictly restricted to the authorized creator account (fridomiamovement@gmail.com).');
      }
      
      onLoginSuccess?.();
    } catch (err: any) {
      console.error('Login failed:', err);
      if (err.code === 'auth/unauthorized-domain' || err.message?.includes('unauthorized-domain') || err.message?.includes('auth/cookie-not-allowed')) {
        setError(
          'Google Sign-In is restricted for this host (e.g. tik-tok-tau-two.vercel.app). Please use the Email & Password option to sign in immediately.'
        );
        setActiveTab('email-signin');
      } else {
        setError(
          err.code === 'auth/popup-closed-by-user'
            ? 'The login popup was closed. Please try again to sign in.'
            : err.message || 'An unexpected error occurred during sign-in.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    // Enforce permission checks inside the UI itself
    if (email.trim().toLowerCase() !== 'fridomiamovement@gmail.com') {
      setError('Access Blocked: Only the creator account (fridomiamovement@gmail.com) is permitted to access this private platform.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    try {
      if (activeTab === 'email-signin') {
        await signInWithEmailAndPassword(auth, email, password);
        onLoginSuccess?.();
      } else {
        // Registering a new password account for the user's secure access
        await createUserWithEmailAndPassword(auth, email, password);
        setSuccessMsg('Account registered successfully! You are now logged in.');
        setTimeout(() => {
          onLoginSuccess?.();
        }, 1500);
      }
    } catch (err: any) {
      console.error('Email authentication failed:', err);
      
      let friendlyError = err.message;
      if (err.code === 'auth/user-not-found') {
        friendlyError = 'No user account exists with this email. If this is your first time using password auth, please tap the "Register Password" tab first to create your credentials.';
      } else if (err.code === 'auth/wrong-password') {
        friendlyError = 'Incorrect password. If you forgot your password or need a new one, please contact database configurations.';
      } else if (err.code === 'auth/operation-not-allowed') {
        friendlyError = 'Email/Password sign-in is not yet enabled in Firebase Console. Please go to your Firebase Console -> Authentication -> Sign-in Method and turn on Email/Password.';
      } else if (err.code === 'auth/email-already-in-use') {
        friendlyError = 'The email matches an existing account. Please sign in instead of registering.';
      } else if (err.code === 'auth/invalid-credential') {
        friendlyError = 'Invalid credentials. Please verify your password and try again.';
      }

      setError(friendlyError);
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
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-cyan-500 via-slate-950 to-fuchsia-500 rounded-2xl flex items-center justify-center p-3 shadow-lg border border-slate-700/50 mb-4">
            <Video className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-white to-fuchsia-400 bg-clip-text text-transparent">
            TikTok Shorts Creator
          </h1>
          <p className="text-slate-400 text-sm mt-1.5">
            AI-driven high-engagement clip extractor and captioning engine
          </p>
        </div>

        {/* Dynamic tab switcher for custom domains */}
        <div className="grid grid-cols-3 bg-slate-955/60 p-1 border border-slate-800 rounded-xl mb-6">
          <button
            onClick={() => { setActiveTab('email-signin'); setError(null); }}
            className={`py-1.5 rounded-lg text-xs font-semibold tracking-tight transition cursor-pointer ${
              activeTab === 'email-signin'
                ? 'bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setActiveTab('email-signup'); setError(null); }}
            className={`py-1.5 rounded-lg text-xs font-semibold tracking-tight transition cursor-pointer ${
              activeTab === 'email-signup'
                ? 'bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Register
          </button>
          <button
            onClick={() => { setActiveTab('google'); setError(null); }}
            className={`py-1.5 rounded-lg text-xs font-semibold tracking-tight transition cursor-pointer ${
              activeTab === 'google'
                ? 'bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Google
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-950/50 border border-slate-850 rounded-xl p-3.5 gap-2.5 flex items-start">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-400 leading-relaxed">
              If Google authentication fails due to unauthorized host domains, use the Email & Password tabs to register or sign in instantly.
            </div>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl p-3 text-left space-y-1.5 leading-snug">
              <p className="font-semibold">{error}</p>
              {error.includes('Email/Password sign-in is not yet enabled') && (
                <div className="pt-1 text-[11px] text-slate-400 border-t border-rose-500/10">
                  <strong>Instructions:</strong>
                  <ol className="list-decimal pl-4 mt-1 space-y-1">
                    <li>Go to your Firebase Console.</li>
                    <li>Click on <strong>Authentication</strong> &rarr; <strong>Sign-in method</strong>.</li>
                    <li>Select <strong>Email/Password</strong> and tap <strong>Enable</strong>.</li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl p-3 text-center">
              {successMsg}
            </div>
          )}

          {/* Render Email/Password form tabs */}
          {activeTab !== 'google' ? (
            <form onSubmit={handleEmailAction} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Authorized Account Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    readOnly
                    placeholder="fridomiamovement@gmail.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-3 text-xs text-slate-400 font-mono tracking-tight cursor-not-allowed focus:outline-none"
                    title="This app is strictly restricted to your account: fridomiamovement@gmail.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Secure Creator Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-3 text-xs text-white placeholder-slate-650 tracking-widest focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-cyan-500/25 cursor-pointer"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : activeTab === 'email-signin' ? (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Secure Sign In</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Register Private Password</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <button
              id="google-login-btn"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-cyan-500/20 cursor-pointer"
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
          )}
        </div>

        {/* Integration details warning info banner */}
        <div className="mt-6 pt-5 border-t border-slate-800 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Secure account identity verified directly via Firebase Auth</span>
          </div>
          {activeTab !== 'google' && (
            <div className="flex items-start gap-2 text-slate-550 text-[10px]">
              <Info className="w-3.5 h-3.5 text-cyan-500/65 shrink-0 mt-0.5" />
              <span>Use the same email to register a private creator password if you haven't set up password credentials yet.</span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

