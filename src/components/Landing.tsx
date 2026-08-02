import { useState } from 'react';
import { Eye, ShieldCheck, Sparkles, Users, Video } from 'lucide-react';
import { Logo } from './ui';
import { pickGooglePhoto, useStore } from '@/store/StoreProvider';

export function Landing() {
  const { signInWithGoogle } = useStore();
  const [busy, setBusy] = useState(false);

  const handleGoogle = async () => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 700));
    signInWithGoogle({
      email: 'new.member@example.com',
      name: 'New Member',
      photo: pickGooglePhoto('new.member@example.com'),
    });
    setBusy(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950">
      {/* Ambient gold glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gold-500/10 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-gold-700/10 blur-[120px]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6">
        {/* Top bar */}
        <header className="flex items-center justify-between py-6">
          <Logo size={40} withText />
          <span className="chip">
            <ShieldCheck size={14} className="text-gold-300" />
            Private community
          </span>
        </header>

        {/* Hero — Facebook-style dual layout */}
        <main className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-2">
          {/* Left column — hero */}
          <div className="animate-slide-up">
            <span className="gold-chip mb-5">
              <Sparkles size={14} /> The social home for the Orthodox faithful
            </span>
            <h1 className="font-serif text-5xl font-semibold leading-[1.05] tracking-tight text-balance md:text-6xl">
              Where the <span className="gold-text">parish</span> meets
              <br />
              the <span className="gold-text">network</span>.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-300">
              Connect with Orthodox Christians across parishes. Share your life, message
              your friends, join live Bible studies, and never miss a Sunday.
            </p>

            {/* Feature pills */}
            <div className="mt-10 grid grid-cols-3 gap-3 max-w-lg">
              <FeaturePill icon={<Users size={18} />} label="Fellowship" />
              <FeaturePill icon={<Video size={18} />} label="Go Live" />
              <FeaturePill icon={<Eye size={18} />} label="Stay close" />
            </div>

            <p className="mt-8 max-w-md text-sm leading-relaxed text-ink-400">
              A private network for the Orthodox faithful — built for fellowship,
              not for the algorithm.
            </p>
          </div>

          {/* Right column — authentication box */}
          <div className="animate-slide-right lg:flex lg:justify-center">
            <div className="card w-full max-w-sm p-8">
              <h2 className="text-center text-2xl font-semibold text-ink-100">
                Welcome to OrthodoxConnect
              </h2>
              <p className="mt-2 text-center text-sm text-ink-400">
                Sign in to join your parish community.
              </p>

              <button
                onClick={handleGoogle}
                disabled={busy}
                className="gold-btn mt-7 w-full justify-center px-6 py-3 text-base"
              >
                <GoogleIcon />
                {busy ? 'Connecting…' : 'Continue with Google'}
              </button>

              <p className="mt-6 text-center text-xs leading-relaxed text-ink-400">
                By continuing you agree to our{' '}
                <a href="#" className="text-gold-300 underline-offset-2 hover:underline">
                  Terms of Service
                </a>{' '}
                &{' '}
                <a href="#" className="text-gold-300 underline-offset-2 hover:underline">
                  Privacy Policy
                </a>
                .
              </p>
            </div>
          </div>
        </main>

        <footer className="py-6 text-center text-xs text-ink-500">
          OrthodoxConnect · A demonstration build · Not affiliated with any specific jurisdiction
        </footer>
      </div>
    </div>
  );
}

function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-ink-700 bg-ink-850/60 px-3 py-4 text-center">
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
