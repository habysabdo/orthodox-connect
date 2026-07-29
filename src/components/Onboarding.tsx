import { useState } from 'react';
import { Camera, Church, Loader2, User as UserIcon } from 'lucide-react';
import { PARISHES } from '../types';
import { Avatar, Logo } from './ui';
import { useStore } from '@/store/StoreProvider';
import { ThemeToggle } from './ThemeToggle';
import { isImageFile, uploadProfilePhoto, validateImage } from '@/utils/imageUpload';
import { firstName, userName } from '@/utils/postSafety';

export function Onboarding() {
  const { users, currentUserId, completeOnboarding, signOut } = useStore();
  const me = users.find((u) => u?.id === currentUserId);

  const [name, setName] = useState(me?.name ?? '');
  const [age, setAge] = useState('');
  const [photo, setPhoto] = useState(me?.photo ?? '');
  const [photoPreview, setPhotoPreview] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [parish, setParish] = useState('');
  const [error, setError] = useState('');

  if (!me) return null;

  /**
   * Store the photo the moment it is chosen, straight into Supabase Storage, and
   * keep only its public URL on the profile. A local preview stands in until the
   * upload finishes.
   */
  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!isImageFile(file)) {
      setError('Please choose a JPEG, PNG, WebP, or GIF image.');
      return;
    }
    const validationError = validateImage(file, 'avatar');
    if (validationError) {
      setError(validationError);
      return;
    }

    const preview = URL.createObjectURL(file);
    setError('');
    setPhotoPreview(preview);
    setUploadingPhoto(true);
    setPhotoProgress(0);
    try {
      setPhoto(await uploadProfilePhoto(file, setPhotoProgress));
    } catch (reason) {
      console.error('Profile photo upload failed', reason);
      setPhotoPreview('');
      setError(reason instanceof Error && reason.message
        ? reason.message
        : 'Your photo could not be uploaded. Please try again.');
    } finally {
      URL.revokeObjectURL(preview);
      setUploadingPhoto(false);
      setPhotoProgress(0);
    }
  };

  const submit = async () => {
    const ageNum = Number(age);
    if (!name.trim()) return setError('Please enter your full name.');
    if (!ageNum || ageNum < 13 || ageNum > 120) return setError('Please enter a valid age (13–120).');
    if (!parish.trim()) return setError('Please enter your church parish.');
    if (uploadingPhoto) return setError('Please wait for your photo to finish uploading.');
    setError('');
    try {
      await completeOnboarding({ name: name.trim(), age: ageNum, photo: photo || me.photo, parish });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to save your profile.');
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-gold-500/10 blur-[140px]" />
      <ThemeToggle className="absolute right-5 top-5 z-10" />

      <div className="relative mx-auto flex min-h-screen max-w-xl flex-col items-center px-6 py-10">
        <Logo size={40} withText />

        <div className="mt-10 w-full animate-slide-up">
          <span className="gold-chip">Welcome, {firstName(userName(me))}</span>
          <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight">
            Complete your <span className="gold-text">profile</span>
          </h1>
          <p className="mt-2 text-sm text-ink-400">
            Let your parish community know who you are. You can edit this later.
          </p>

          <div className="card mt-6 p-6">
            {/* Photo */}
            <div className="mb-6 flex items-center gap-5">
              <Avatar src={photoPreview || photo || me.photo} name={name || me.name} size={84} ring="gold" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-100">Profile photo</p>
                <p className="mb-2 text-xs text-ink-400">Defaults to your Google photo.</p>
                <label className="ghost-btn cursor-pointer text-xs">
                  <Camera size={14} />
                  {uploadingPhoto ? 'Uploading…' : 'Upload new'}
                  <input type="file" accept="image/*" onChange={handlePhoto} disabled={uploadingPhoto} className="hidden" />
                </label>
                {uploadingPhoto && (
                  <div className="mt-2 max-w-[220px]" aria-live="polite">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-ink-400">
                      <span className="flex items-center gap-1.5">
                        <Loader2 size={12} className="animate-spin" /> Uploading
                      </span>
                      <span>{photoProgress}%</span>
                    </div>
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-ink-800"
                      role="progressbar"
                      aria-valuenow={photoProgress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className="h-full rounded-full bg-gold-400 transition-[width]" style={{ width: `${photoProgress}%` }} />
                    </div>
                  </div>
                )}
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
              <div role="alert" className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => void submit()}
                disabled={uploadingPhoto}
                className="gold-btn flex-1 py-3 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploadingPhoto ? 'Uploading your photo…' : 'Enter OrthodoxConnect'}
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
