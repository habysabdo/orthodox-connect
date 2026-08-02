import { useState } from 'react';
import { Eye, ShieldCheck, Sparkles, Users, Video, Mail, Lock, User as UserIcon } from 'lucide-react';
import { Logo } from './ui';
import { useStore, pickGooglePhoto } from '@/store/context';
import { useI18n } from '@/store/i18n';
import { ADMIN_EMAIL } from '@/types';

export function Landing() {
  const { signInWithGoogle, signInWithEmail } = useStore();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleGoogle = async () => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 500));
    signInWithGoogle({
      email: 'new.member@example.com',
      name: 'New Member',
      photo: pickGooglePhoto('new.member@example.com'),
    });
    setBusy(false);
  };

  const handleEmail = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setBusy(true);
    await new Promise((r) => setTimeout(r, 500));

    const isAdmin = email.trim().toLowerCase() === ADMIN_EMAIL;
    const displayName = mode === 'signup' && name.trim() ? name.trim() : email.split('@')[0];

    signInWithEmail({
      email: email.trim(),
      name: displayName,
      photo: pickGooglePhoto(email),
      role: isAdmin ? 'admin' : 'member',
    });
    setBusy(false);
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

              {/* Tab switcher */}
              <div className="mt-6 flex gap-1 rounded-xl border border-ink-700 bg-ink-900/50 p-1">
                <button
                  onClick={() => setMode('signin')}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                    mode === 'signin' ? 'bg-gold-400/15 text-gold-200' : 'text-ink-400 hover:text-ink-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setMode('signup')}
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
                    onKeyDown={(e) => e.key === 'Enter' && handleEmail()}
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
                    onKeyDown={(e) => e.key === 'Enter' && handleEmail()}
                  />
                </div>
                {error && <p className="text-xs text-maroon-400">{error}</p>}
                <button
                  onClick={handleEmail}
                  disabled={busy}
                  className="gold-btn w-full justify-center px-6 py-3 text-base"
                >
                  {busy ? t('landing.connecting') : mode === 'signin' ? 'Sign In' : 'Create Account'}
                </button>
              </div>

              {/* Divider */}
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-ink-700" />
                <span className="text-xs text-ink-400">or</span>
                <div className="h-px flex-1 bg-ink-700" />
              </div>

              <button
                onClick={handleGoogle}
                disabled={busy}
                className="ghost-btn w-full justify-center px-6 py-3 text-base"
              >
                <GoogleIcon />
                {busy ? t('landing.connecting') : t('landing.continueGoogle')}
              </button>

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

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
