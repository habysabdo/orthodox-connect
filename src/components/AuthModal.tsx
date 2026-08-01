import React, { useState } from 'react';
import { Mail, Lock, User, UserPlus, LogIn, AlertCircle } from 'lucide-react';
import netlifyIdentity from 'netlify-identity-widget';
import { persistIdentityCookiesFromLocalStorage } from '../lib/auth';
import {
  clearLocalAuthStorage,
  clearSessionExpiredNotice,
  hasSessionExpiredNotice,
} from '../lib/sessionRecovery';

type GoTrueClient = {
  login: (email: string, password: string, remember?: boolean) => Promise<unknown>;
  signup: (
    email: string,
    password: string,
    data?: Record<string, unknown>
  ) => Promise<{ confirmed_at?: string | null; email_confirmed_at?: string | null } | undefined>;
};

/**
 * Resolve the headless GoTrue client that backs Netlify Identity.
 *
 * Never read `netlifyIdentity.gotrue`: that getter opens the prebuilt widget
 * modal as a side effect whenever the client is not ready yet, which is what
 * stacked a blank iframe popup on top of this card. The store holds the same
 * instance without any side effect.
 */
function resolveGoTrueClient(): GoTrueClient | null {
  const widget = netlifyIdentity as { store?: { gotrue?: GoTrueClient | null }; init?: (options?: unknown) => void };

  if (widget.store?.gotrue) return widget.store.gotrue;

  // The store is only populated once the widget has been initialized. init() is
  // idempotent and, unlike open(), never renders the modal.
  try {
    widget.init?.();
  } catch {
    // Safe fallback if initialized already
  }
  if (widget.store?.gotrue) return widget.store.gotrue;

  // Last resort: the widget bundle exposes the GoTrue constructor globally, so
  // we can talk to this site's Identity instance directly.
  const GoTrue = (window as { GoTrue?: new (options: Record<string, unknown>) => GoTrueClient }).GoTrue;
  if (!GoTrue) return null;

  return new GoTrue({
    APIUrl: `${window.location.origin}/.netlify/identity`,
    setCookie: true,
    clientName: 'orthodox-connect',
  });
}

function describeAuthError(err: unknown, isRegister: boolean): string {
  const status = (err as { status?: number } | null)?.status;
  const message = err instanceof Error && err.message ? err.message : '';

  if (/email not confirmed/i.test(message)) {
    return 'Please confirm your email address first — check your inbox for the confirmation link.';
  }
  switch (status) {
    case 401:
      return 'Invalid email or password.';
    case 403:
      return isRegister
        ? 'Registration is currently closed. Ask a parish administrator for an invite.'
        : 'This account is not allowed to sign in.';
    case 422:
      return message || 'Please check your email address and choose a stronger password.';
    case 404:
      return 'We could not find an account with that email address.';
    default:
      return message || 'Something went wrong. Please try again.';
  }
}

export const AuthModal: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(() =>
    // A member who was signed out by a failed refresh arrives here without
    // having asked to, so the form opens by explaining why.
    hasSessionExpiredNotice() ? 'Your session expired, so you were signed out. Please log in again.' : '',
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
      const gotrue = resolveGoTrueClient();
      if (!gotrue) {
        setError('Sign in is unavailable right now. Please reload the page and try again.');
        return;
      }

      // This form is only reachable while nobody is signed in, so any session
      // still on disk is a leftover from a refresh that failed. Dropping it
      // first means this attempt starts from a clean slate instead of having
      // GoTrue reuse a token the server has already rejected.
      clearLocalAuthStorage();

      if (isRegister) {
        const created = await gotrue.signup(email, password, { full_name: fullName });
        const autoConfirmed = Boolean(created?.confirmed_at || created?.email_confirmed_at);

        if (!autoConfirmed) {
          // Confirmation is required, so no session exists yet.
          setNotice('Account created. Check your inbox to confirm your email, then log in.');
          setIsRegister(false);
          setPassword('');
          return;
        }
      }

      // `remember: true` makes GoTrue persist the session to localStorage and
      // ask Identity for a durable nf_jwt cookie rather than a session cookie.
      await gotrue.login(email, password, true);

      // Mirror the stored session into the nf_jwt / nf_refresh cookies so the
      // CDN and our /api routes see the signed-in user, then do a full
      // navigation into the parish dashboard with those cookies attached.
      persistIdentityCookiesFromLocalStorage();
      navigating = true;
      if (window.location.pathname === '/login') window.location.replace('/');
      else window.location.reload();
    } catch (err) {
      console.error('Authentication failed', err);
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