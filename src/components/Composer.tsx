import { useRef, useState } from 'react';
import { ImagePlus, Radio, Send, Sparkles, X } from 'lucide-react';
import { Avatar } from './ui';
import { useStore } from '@/store/context';
import { useUI } from '@/store/ui';

const SAMPLE_IMAGES = [
  'https://images.pexels.com/photos/2014773/pexels-photo-2014773.jpeg',
  'https://images.pexels.com/photos/2065891/pexels-photo-2065891.jpeg',
  'https://images.pexels.com/photos/164743/pexels-photo-164743.jpeg',
  'https://images.pexels.com/photos/8108069/pexels-photo-8108069.jpeg',
];

export function Composer() {
  const { users, currentUserId, createPost } = useStore();
  const { setGoLiveOpen } = useUI();
  const me = users.find((u) => u.id === currentUserId);
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | undefined>();
  const [focused, setFocused] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!me) return null;

  const canPublish = text.trim().length > 0 || !!image;

  const publish = () => {
    if (!canPublish) return;
    createPost({ text: text.trim(), image });
    setText('');
    setImage(undefined);
    setFocused(false);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="card p-4">
      <div className="flex gap-3">
        <Avatar src={me.photo} name={me.name} size={44} ring="gold" />
        <div className="flex-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="What's on your mind, in Christ?"
            rows={focused ? 3 : 1}
            className="w-full resize-none rounded-xl border border-ink-700 bg-ink-900/60 px-4 py-3 text-sm text-ink-100 placeholder-ink-400 outline-none transition-all focus:border-gold-400/50 focus:ring-2 focus:ring-gold-400/15"
          />

          {image && (
            <div className="relative mt-3 overflow-hidden rounded-xl border border-ink-700">
              <img src={image} alt="attachment" className="max-h-72 w-full object-cover" referrerPolicy="no-referrer" />
              <button
                onClick={() => setImage(undefined)}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white backdrop-blur hover:bg-black/80"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {(focused || text || image) && (
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-700 pt-3 animate-fade-in">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-300 transition-colors hover:bg-ink-800 hover:text-emerald-300"
                >
                  <ImagePlus size={16} /> Photo
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
                <button
                  onClick={() => setImage(SAMPLE_IMAGES[Math.floor(Math.random() * SAMPLE_IMAGES.length)])}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-300 transition-colors hover:bg-ink-800 hover:text-gold-300"
                >
                  <Sparkles size={16} /> Sample
                </button>
                <button
                  onClick={() => setGoLiveOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-300 transition-colors hover:bg-ink-800 hover:text-red-300"
                >
                  <Radio size={16} /> Go Live
                </button>
              </div>
              <button onClick={publish} disabled={!canPublish} className="gold-btn py-2 text-sm">
                <Send size={14} /> Publish
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
