// The ringtone that plays while an incoming call is on screen.
//
// `/ringtone.mp3` is played when the deployment ships one: drop an audio file at
// `public/ringtone.mp3` and it is used automatically, no code change needed.
// Until then — and whenever the file cannot be decoded, or a browser refuses to
// autoplay it — a two-tone ring is synthesised with the Web Audio API, so a call
// is never silent. Phones are buzzed alongside the tone.

/** Audio file used for ringing when the deployment provides one. */
const RINGTONE_URL = '/ringtone.mp3';

/** Length of one ring burst, in seconds. */
const RING_TONE_S = 1.1;

/** Gap between ring bursts, matching a classic ring cadence. */
const RING_CYCLE_MS = 4000;

/** Buzz pattern repeated once per ring cycle on devices that vibrate. */
const VIBRATE_PATTERN = [600, 300, 600, 2200];

type AudioContextCtor = new () => AudioContext;

function audioContextCtor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const scope = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return scope.AudioContext ?? scope.webkitAudioContext;
}

/** A repeating dual-tone ring, used when no ringtone file can be played. */
function playSynthesizedRing(): () => void {
  const Ctor = audioContextCtor();
  if (!Ctor) return () => undefined;

  let context: AudioContext;
  try {
    context = new Ctor();
  } catch {
    return () => undefined;
  }
  // A tab that has never been interacted with starts suspended; resuming is
  // best-effort, and the call overlay is still visible either way.
  void context.resume?.().catch(() => undefined);

  const burst = () => {
    if (context.state === 'closed') return;
    const start = context.currentTime;
    [440, 480].forEach((frequency) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.06);
      gain.gain.setValueAtTime(0.12, start + RING_TONE_S - 0.1);
      gain.gain.linearRampToValueAtTime(0, start + RING_TONE_S);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + RING_TONE_S + 0.05);
    });
  };

  burst();
  const timer = window.setInterval(burst, RING_CYCLE_MS);
  return () => {
    window.clearInterval(timer);
    void context.close().catch(() => undefined);
  };
}

function startVibration(): () => void {
  const vibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
    ? navigator.vibrate.bind(navigator)
    : undefined;
  if (!vibrate) return () => undefined;

  const buzz = () => {
    try {
      vibrate(VIBRATE_PATTERN);
    } catch {
      // Vibration is a courtesy; a browser that blocks it changes nothing else.
    }
  };
  buzz();
  const timer = window.setInterval(buzz, RING_CYCLE_MS);
  return () => {
    window.clearInterval(timer);
    try {
      vibrate(0);
    } catch {
      // ignored
    }
  };
}

/**
 * Start ringing. Call the returned function to stop — it silences the audio
 * element, the synthesised fallback and the vibration together.
 */
export function startRingtone(): () => void {
  if (typeof window === 'undefined') return () => undefined;

  let stopped = false;
  let stopSynthesized: (() => void) | null = null;
  const stopVibration = startVibration();

  const fallBackToSynthesized = () => {
    if (stopped || stopSynthesized) return;
    stopSynthesized = playSynthesizedRing();
  };

  let audio: HTMLAudioElement | null = null;
  try {
    audio = new Audio(RINGTONE_URL);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.9;
    audio.addEventListener('error', fallBackToSynthesized);
    void audio.play().catch(fallBackToSynthesized);
  } catch {
    fallBackToSynthesized();
  }

  return () => {
    stopped = true;
    if (audio) {
      audio.removeEventListener('error', fallBackToSynthesized);
      audio.pause();
      // Detach the source so a partially loaded file stops downloading.
      audio.removeAttribute('src');
      audio.load();
    }
    stopSynthesized?.();
    stopVibration();
  };
}
