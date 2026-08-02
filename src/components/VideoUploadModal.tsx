import { useRef, useState } from 'react';
import { Hash, Loader2, Upload, X } from 'lucide-react';
import { Modal } from './ui';
import { useStore } from '@/store/context';
import { useI18n } from '@/store/i18n';
import { supabase } from '@/lib/supabase';
import { uploadToBunny, isBunnyConfigured } from '@/lib/bunny';
import { createPostInDb } from '@/utils/posts';

interface VideoUploadModalProps {
  open: boolean;
  onClose: () => void;
}

const SUGGESTED_TAGS = ['Orthodox', 'Patristics', 'Prayer', 'Liturgy', 'Chant', 'Fasting', 'Youth', 'Scripture'];

export function VideoUploadModal({ open, onClose }: VideoUploadModalProps) {
  const { createPost, users, currentUserId } = useStore();
  const { t } = useI18n();
  const me = users.find((u) => u.id === currentUserId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [uploading, setUploading] = useState(false);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setMediaUrl(URL.createObjectURL(f));
    setMediaType(f.type.startsWith('video') ? 'video' : 'image');
  };

  const addTag = (tag: string) => {
    const clean = tag.trim().replace(/^#/, '');
    if (clean && !tags.includes(clean)) {
      setTags((prev) => [...prev, clean]);
    }
    setTagInput('');
  };

  const uploadToStorage = async (f: File): Promise<string | null> => {
    const ext = f.name.split('.').pop() ?? 'bin';
    const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('media').upload(path, f, { contentType: f.type });
    if (error) {
      console.error('Upload error:', error.message);
      return null;
    }
    const { data: urlData } = supabase.storage.from('media').getPublicUrl(path);
    return urlData.publicUrl;
  };

  const submit = async () => {
    if (!me || !caption.trim()) return;
    setUploading(true);

    let finalMediaUrl: string | undefined;

    if (file) {
      if (mediaType === 'video' && isBunnyConfigured()) {
        // Try Bunny Stream for video uploads
        const bunnyUrl = await uploadToBunny(file, caption.trim());
        if (bunnyUrl) {
          finalMediaUrl = bunnyUrl;
        } else {
          // Fallback to Supabase Storage
          finalMediaUrl = (await uploadToStorage(file)) ?? mediaUrl ?? undefined;
        }
      } else {
        // Photos go to Supabase Storage
        finalMediaUrl = (await uploadToStorage(file)) ?? mediaUrl ?? undefined;
      }
    } else if (mediaUrl) {
      finalMediaUrl = mediaUrl;
    }

    const fullText = `${caption.trim()}${tags.length ? ' ' + tags.map((t) => `#${t}`).join(' ') : ''}`;

    // Persist to Supabase DB
    try {
      await createPostInDb({
        text: fullText,
        authorName: me.name,
        authorId: me.id,
        image: finalMediaUrl,
      });
    } catch (e) {
      console.error('DB insert failed:', e);
    }

    // Also add to local state for instant feedback
    createPost({ text: fullText, image: finalMediaUrl });

    setUploading(false);
    reset();
    onClose();
  };

  const reset = () => {
    setFile(null);
    setMediaUrl(null);
    setCaption('');
    setTags([]);
    setTagInput('');
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} size="md">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-ink-100">{t('upload.title')}</h2>
          <button onClick={() => { reset(); onClose(); }} className="ghost-btn p-2">
            <X size={16} />
          </button>
        </div>

        {/* Media picker */}
        <div
          onClick={() => fileRef.current?.click()}
          className="mt-4 flex aspect-[9/16] max-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink-600 bg-ink-900/50 transition-colors hover:border-gold-400/50"
        >
          {mediaUrl ? (
            mediaType === 'video' ? (
              <video src={mediaUrl} className="h-full w-full rounded-2xl object-cover" controls />
            ) : (
              <img src={mediaUrl} alt="" className="h-full w-full rounded-2xl object-cover" />
            )
          ) : (
            <div className="flex flex-col items-center gap-2 text-ink-400">
              <Upload size={32} />
              <span className="text-sm">{t('upload.tap')}</span>
              <span className="text-xs text-ink-500">{t('upload.formats')}</span>
            </div>
          )}
          <input ref={fileRef} type="file" accept="video/*,image/*" onChange={onFile} className="hidden" />
        </div>

        {/* Caption */}
        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-400">{t('upload.caption')}</label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={2}
            placeholder={t('upload.captionPlaceholder')}
            className="input resize-none"
          />
        </div>

        {/* Hashtags */}
        <div className="mt-3">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-400">{t('upload.hashtags')}</label>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="gold-chip">
                <Hash size={10} /> {tag}
                <button onClick={() => setTags((prev) => prev.filter((t) => t !== tag))} className="ml-1 text-gold-400 hover:text-gold-200">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag(tagInput)}
              placeholder={t('upload.addHashtag')}
              className="input flex-1"
            />
            <button onClick={() => addTag(tagInput)} className="ghost-btn px-3">
              <Hash size={14} /> {t('upload.add')}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).map((tag) => (
              <button
                key={tag}
                onClick={() => addTag(tag)}
                className="chip text-[11px] transition-colors hover:border-gold-400/40 hover:text-gold-200"
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => { reset(); onClose(); }} className="ghost-btn py-2">{t('common.cancel')}</button>
          <button onClick={submit} disabled={!caption.trim() || uploading} className="gold-btn py-2">
            {uploading ? (
              <><Loader2 size={16} className="animate-spin" /> {t('common.uploading')}</>
            ) : (
              <><Upload size={16} /> {t('common.postToFeed')}</>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
