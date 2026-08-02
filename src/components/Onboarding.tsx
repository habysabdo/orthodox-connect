import { useState } from 'react';
import { Camera, Church, User as UserIcon } from 'lucide-react';
import { PARISHES } from '../types';
import { Avatar, Logo } from './ui';
import { useStore } from '@/store/StoreProvider';
import { useAuth } from '@/store/auth';
import { useToast } from './Toast';

export function Onboarding() {
  const { users, currentUserId } = useStore();
  const { profile, updateProfile, signOut } = useAuth();
  const { notify } = useToast();
  const me = users.find((u) => u.id === currentUserId);

  const [name, setName] = useState(me?.name ?? '');
  const [age, setAge] = useState('');
  const [photo, setPhoto] = useState(me?.photo ?? '');
  const [parish, setParish] = useState('');
  const [error, setError] = useState('');

  if (!me) return null;

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    const ageNum = Number(age);
    if (!name.trim()) return setError('Please enter your full name.');
    if (!ageNum || ageNum < 13 || ageNum > 120) return setError('Please enter a valid age (13–120).');
    if (!parish.trim()) return setError('Please enter your church parish.');
    const { error } = await updateProfile({
      display_name: name.trim(),
      parish: parish.trim(),
      photo_url: photo || me?.photo || '',
      onboarded: true,
    });
    if (error) {
      notify('error', `Failed to save: ${error}`);
    } else {
      notify('success', 'Profile created! Welcome to OrthodoxConnect.');
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-gold-500/10 blur-[140px]" />

      <div className="relative mx-auto flex min-h-screen max-w-xl flex-col items-center px-6 py-10">
        <Logo size={40} withText />

        <div className="mt-10 w-full animate-slide-up">
          <span className="gold-chip">Welcome, {me.name.split(' ')[0]}</span>
          <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight">
            Complete your <span className="gold-text">profile</span>
          </h1>
          <p className="mt-2 text-sm text-ink-400">
            Let your parish community know who you are. You can edit this later.
          </p>

          <div className="card mt-6 p-6">
            {/* Photo */}
            <div className="mb-6 flex items-center gap-5">
              <Avatar src={photo || me.photo} name={name || me.name} size={84} ring="gold" />
              <div>
                <p className="text-sm font-semibold text-ink-100">Profile photo</p>
                <p className="mb-2 text-xs text-ink-400">Defaults to your Google photo.</p>
                <label className="ghost-btn cursor-pointer text-xs">
                  <Camera size={14} />
                  Upload new
                  <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
                </label>
              </div>
            </div>

            {/* Name */}
            <Field label="Full name" icon={<UserIcon size={14} />}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="input"
              />
            </Field>

            {/* Age */}
            <Field label="Age">
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 28"
                min={13}
                max={120}
                className="input"
              />
            </Field>

            {/* Parish — free-text with optional suggestions */}
            <Field label="Church parish" icon={<Church size={14} />}>
              <input
                value={parish}
                onChange={(e) => setParish(e.target.value)}
                list="parish-suggestions"
                placeholder="Type your church or parish (e.g. St. Mark, St. Mary)"
                className="input"
                autoComplete="off"
              />
              <datalist id="parish-suggestions">
                {PARISHES.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
              <p className="mt-1.5 text-[11px] text-ink-500">
                Type any parish name — suggestions are optional.
              </p>
            </Field>

            {error && (
              <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="mt-6 flex items-center gap-3">
              <button onClick={submit} className="gold-btn flex-1 py-3">
                Enter OrthodoxConnect
              </button>
              <button onClick={signOut} className="ghost-btn py-3">
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-400">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}
