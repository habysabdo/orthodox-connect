import React, { useState } from 'react';
import { Mail, Lock, User, UserPlus, LogIn, AlertCircle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import {
  clearSessionExpiredNotice,
  hasSessionExpiredNotice,
} from '../lib/sessionRecovery';

// Initialize Supabase client directly from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function describeAuthError(err: unknown, isRegister: boolean): string {
  const message = err instanceof Error && err.message ? err.message : '';

  if (/email not confirmed/i.test(message)) {
    return 'Please confirm your email address first — check your inbox for the confirmation link.';
  }
  if (/invalid login credentials/i.test(message)) {
    return 'Invalid email or password.';
  }
  if (/user already registered/i.test(message)) {
    return 'An account with this email already exists. Try logging in instead.';
  }
  if (/password/i.test(message)) {
    return 'Password must be at least 6 characters long.';
  }
  return message || 'Something went wrong. Please try again.';
}

export const AuthModal: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(() =>
    hasSessionExpiredNotice()
      ? 'Your session expired, so you were signed out. Please log in again.'
      : ''
  );
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    clearSessionExpiredNotice();

    setBusy(true);
    let navigating = false;

    try {
      if (isRegister) {
        // Perform Supabase Registration
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (signUpError) throw signUpError;

        // If email confirmation is enabled on Supabase, no session is returned immediately
        if (!signUpData.session) {
          setNotice('Account created! Check your inbox to confirm your email, then log in.');
          setIsRegister(false);
          setPassword('');
          setBusy(false);
          return;
        }
      } else {
        // Perform Supabase Login
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
      }

      navigating = true;
      if (window.location.pathname === '/login') {
        window.location.replace('/');
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error('Authentication failed:', err);
      setError(describeAuthError(err, isRegister));
    } finally {
      if (!navigating) setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 p-4 text-ink-100">
      <div className="w-full max-w-md rounded-2xl border border-gold-400/30 bg-ink-850 p-8 shadow-card backdrop-blur-sm">

        <div className="text-center mb-6">
          <h2 className="text-3xl font-serif text-amber-400 font-bold tracking-wide">
            {isRegister ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="mt-1 text-sm text-ink-400">
            {isRegister
              ? 'Register once to join OrthodoxConnect'
              : 'Sign in to access your parish network'}
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-amber-300 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-5 w-5 text-ink-400" />
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-ink-700 bg-ink-900 py-2 pl-10 pr-4 text-ink-100 placeholder-ink-500 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-amber-300 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-ink-400" />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-ink-700 bg-ink-900 py-2 pl-10 pr-4 text-ink-100 placeholder-ink-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-amber-300 uppercase tracking-wider mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-ink-400" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-ink-700 bg-ink-900 py-2 pl-10 pr-4 text-ink-100 placeholder-ink-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 py-3 font-bold text-[#17130a] shadow-lg transition-all hover:from-amber-600 hover:to-amber-700 hover:shadow-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRegister ? (
              <>
                <UserPlus className="w-5 h-5" /> {busy ? 'Registering…' : 'Register Account'}
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" /> {busy ? 'Logging in…' : 'Log In'}
              </>
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-ink-700 pt-4 text-center">
          <p className="text-sm text-ink-400">
            {isRegister ? 'Already have an account?' : "Don't have an account yet?"}{' '}
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
                setNotice('');
              }}
              className="text-amber-400 font-semibold hover:underline ml-1"
            >
              {isRegister ? 'Log In here' : 'Register now'}
            </button>
          </p>
        </div>

      </div>
    </div>
  );
};