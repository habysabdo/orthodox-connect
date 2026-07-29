import { Eye, ShieldCheck, Sparkles, Users, Video } from 'lucide-react';
import { Logo } from './ui';
import { AuthModal } from './AuthModal';
import { MobileInstallBanner } from './MobileInstallBanner';
import { ThemeToggle } from './ThemeToggle';

export function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950">
      {/* Ambient gold glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gold-500/10 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-gold-700/10 blur-[120px]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6">
        {/* Install banner — prominent, top of page, mobile visitors only */}
        <div className="pt-3">
          <MobileInstallBanner />
        </div>

        {/* Top bar */}
        <header className="flex items-center justify-between py-6">
          <Logo size={40} withText />
          <div className="flex items-center gap-2">
            <span className="chip hidden sm:inline-flex">
              <ShieldCheck size={14} className="text-gold-300" />
              Private community
            </span>
            <ThemeToggle />
          </div>
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

          {/* Right column — AuthModal replace original login box */}
          <div className="animate-slide-right lg:flex lg:justify-center">
            <div className="w-full max-w-md">
              <AuthModal />
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
