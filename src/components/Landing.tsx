import { useState, useEffect } from 'react';
import { Eye, ShieldCheck, Sparkles, Users, Video, Mail, Lock, User as UserIcon, Loader2, Gift } from 'lucide-react';
import { Logo } from './ui';
import { useI18n } from '@/store/i18n';
import { useAuth } from '@/store/auth';

const APP_DOMAIN = import.meta.env.VITE_APP_DOMAIN || 'https://orthodoxconnect.live';

export function Landing() {
  const { signIn, signUp } = useAuth();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [refCode, setRefCode] = useState<string | null>(null);

  // Detect /invite?ref=... and pre-fill sign-up mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      setRefCode(ref);
      setMode('signup');
    }
  }, []);

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleSubmit = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    if (!validateEmail(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    setBusy(true);
    if (mode === 'signin') {
      const { error: err } = await signIn(email.trim(), password);
      if (err) {
        setError(err);
        setBusy(false);
      }
    } else {
      const { error: err } = await signUp(email.trim(), password, name.trim(), refCode ?? undefined);
      if (err) {
        setError(err);
        setBusy(false);
      }
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950">
      {/* Dynamic background glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 animate-pulse-gold rounded-full bg-gold-500/10 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-maroon-600/10 blur-[120px]" />
      <div className="pointer-events-none absolute left-0 top-1/3 h-[300px] w-[300px] rounded-full bg-gold-700/8 blur-[100px]" />

      {/* Sacred geometry pattern overlay */}
      <div className="sacred-geometry pointer-events-none absolute inset-0 opacity-60" />

      {/* Parchment overlay for subtle texture */}
      <div className="parchment-overlay pointer-events-none absolute inset-0" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6">
        {/* Top bar */}
        <header className="flex items-center justify-between py-6">
          <Logo size={40} withText />
          <span className="chip">
            <ShieldCheck size={14} className="text-gold-300" />
            {t('landing.private')}
          </span>
        </header>

        {/* Hero — dual layout */}
        <main className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-2">
          {/* Left column — hero */}
          <div className="animate-slide-up">
            <span className="gold-chip mb-5">
              <Sparkles size={14} /> {t('landing.tagline')}
            </span>
            <h1 className="font-serif text-5xl font-semibold leading-[1.05] tracking-tight text-balance md:text-6xl">
              {t('landing.hero1')} <span className="gold-text">{t('landing.hero2')}</span>{' '}
              {t('landing.hero3')} <span className="gold-text">{t('landing.hero4')}</span>.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-300">
              {t('landing.heroDesc')}
            </p>

            {/* Feature pills */}
            <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
              <FeaturePill icon={<Users size={18} />} label={t('landing.fellowship')} />
              <FeaturePill icon={<Video size={18} />} label={t('landing.goLive')} />
              <FeaturePill icon={<Eye size={18} />} label={t('landing.stayClose')} />
            </div>

            <p className="mt-8 max-w-md text-sm leading-relaxed text-ink-400">
              {t('landing.privacy')}
            </p>
          </div>

          {/* Right column — auth box */}
          <div className="animate-slide-right lg:flex lg:justify-center">
            <div className="card w-full max-w-sm p-8">
              <h2 className="text-center text-2xl font-semibold text-ink-100">
                {t('landing.welcome')}
              </h2>
              <p className="mt-2 text-center text-sm text-ink-400">
                {t('landing.signIn')}
              </p>

              {/* Referral banner */}
              {refCode && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-gold-400/40 bg-gold-400/10 px-3 py-2 text-xs text-gold-200">
                  <Gift size={14} />
                  <span>You were invited! Sign up to join your friend's parish community.</span>
                </div>
              )}

              {/* Tab switcher */}
              <div className="mt-6 flex gap-1 rounded-xl border border-ink-700 bg-ink-900/50 p-1">
                <button
                  onClick={() => { setMode('signin'); setError(''); }}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                    mode === 'signin' ? 'bg-gold-400/15 text-gold-200' : 'text-ink-400 hover:text-ink-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setMode('signup'); setError(''); }}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                    mode === 'signup' ? 'bg-gold-400/15 text-gold-200' : 'text-ink-400 hover:text-ink-200'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {/* Email/password form */}
              <div className="mt-5 space-y-3">
                {mode === 'signup' && (
                  <div className="relative">
                    <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full name"
                      className="input pl-10"
                    />
                  </div>
                )}
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="input pl-10"
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  />
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="input pl-10"
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  />
                </div>
                {error && <p className="text-xs text-maroon-400">{error}</p>}
                <button
                  onClick={handleSubmit}
                  disabled={busy}
                  className="gold-btn w-full justify-center px-6 py-3 text-base"
                >
                  {busy ? (
                    <><Loader2 size={18} className="animate-spin" /> {t('landing.connecting')}</>
                  ) : mode === 'signin' ? 'Sign In' : 'Create Account'}
                </button>
              </div>

              <p className="mt-6 text-center text-xs leading-relaxed text-ink-400">
                {t('landing.byContinue')}{' '}
                <a href="#" className="text-gold-300 underline-offset-2 hover:underline">
                  {t('landing.terms')}
                </a>{' '}
                {t('landing.and')}{' '}
                <a href="#" className="text-gold-300 underline-offset-2 hover:underline">
                  {t('landing.privacyPolicy')}
                </a>
                .
              </p>
            </div>
          </div>
        </main>

        <footer className="py-6 text-center text-xs text-ink-500">
          {t('landing.footer')}
        </footer>
      </div>
    </div>
  );
}

function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-ink-700 bg-ink-850/60 px-3 py-4 text-center backdrop-blur-sm">
      <span className="text-gold-300">{icon}</span>
      <span className="text-xs font-medium text-ink-300">{label}</span>
    </div>
  );
}
