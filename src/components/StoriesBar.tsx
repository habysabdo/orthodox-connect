import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { Avatar } from './ui';
import { useStore } from '@/store/context';
import { seedStories } from '@/data/content';
import type { Story } from '@/types';
import { timeAgo } from '@/utils/format';

export function StoriesBar() {
  const { users, currentUserId } = useStore();
  const [viewing, setViewing] = useState<number | null>(null);
  const me = users.find((u) => u.id === currentUserId);

  const stories = seedStories;

  return (
    <>
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-2.5">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-ink-400">Stories</span>
        </div>
        <div className="no-scrollbar flex gap-3 overflow-x-auto p-4">
          {/* Your story / create */}
          <button className="group flex w-16 shrink-0 flex-col items-center gap-1.5">
            <div className="relative">
              <Avatar src={me?.photo ?? ''} name={me?.name ?? 'Me'} size={56} />
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-gold-400 text-ink-950 shadow-lg ring-2 ring-ink-850">
                <Plus size={14} />
              </span>
            </div>
            <span className="truncate text-[11px] text-ink-400">Your story</span>
          </button>

          {stories.map((story, i) => {
            const author = users.find((u) => u.id === story.authorId);
            const unseen = me ? !story.viewedBy.includes(me.id) : true;
            return (
              <button
                key={story.id}
                onClick={() => setViewing(i)}
                className="group flex w-16 shrink-0 flex-col items-center gap-1.5"
              >
                <motion.div
                  whileTap={{ scale: 0.92 }}
                  className={`rounded-full p-[2.5px] transition-all ${
                    unseen
                      ? 'bg-gradient-to-tr from-gold-400 via-gold-300 to-gold-500 animate-story-glow'
                      : 'bg-ink-600'
                  }`}
                >
                  <div className="rounded-full ring-2 ring-ink-850">
                    <Avatar src={author?.photo ?? ''} name={author?.name ?? 'User'} size={52} />
                  </div>
                </motion.div>
                <span className="truncate text-[11px] text-ink-300">
                  {author?.name.split(' ')[0] ?? 'User'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {viewing !== null && (
          <StoryViewer
            stories={stories}
            startIndex={viewing}
            onClose={() => setViewing(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function StoryViewer({
  stories,
  startIndex,
  onClose,
}: {
  stories: Story[];
  startIndex: number;
  onClose: () => void;
}) {
  const { users } = useStore();
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);

  const story = stories[index];
  const author = users.find((u) => u.id === story.authorId);

  // Auto-advance timer — resets per story via [index] dep
  useEffect(() => {
    setProgress(0);
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          if (index < stories.length - 1) {
            setIndex((i) => i + 1);
            return 0;
          } else {
            onClose();
            return 100;
          }
        }
        return p + 2;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [index, stories.length, onClose]);

  const tapLeft = () => {
    setProgress(0);
    if (index > 0) setIndex(index - 1);
  };
  const tapRight = () => {
    setProgress(0);
    if (index < stories.length - 1) setIndex(index + 1);
    else onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative h-full w-full max-w-md overflow-hidden bg-ink-950 sm:h-[90vh] sm:rounded-2xl"
      >
        {/* Image */}
        <img
          src={story.mediaUrl}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60" />

        {/* Progress bars */}
        <div className="absolute left-0 right-0 top-0 flex gap-1 p-3">
          {stories.map((_, i) => (
            <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-gold-400 transition-all"
                style={{ width: i < index ? '100%' : i === index ? `${progress}%` : '0%' }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute left-0 right-0 top-7 flex items-center gap-3 p-4">
          <Avatar src={author?.photo ?? ''} name={author?.name ?? 'User'} size={36} ring="gold" />
          <div className="flex-1">
            <span className="text-sm font-semibold text-white">{author?.name}</span>
            <span className="ml-2 text-xs text-white/60">{timeAgo(story.createdAt)} ago</span>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-white/80 hover:bg-white/10">
            <X size={20} />
          </button>
        </div>

        {/* Caption */}
        {story.caption && (
          <div className="absolute bottom-20 left-0 right-0 p-4">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-sm font-medium text-white drop-shadow-lg"
            >
              {story.caption}
            </motion.p>
          </div>
        )}

        {/* Quick reply */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 p-4">
          <input
            placeholder={`Reply to ${author?.name.split(' ')[0] ?? 'story'}...`}
            className="flex-1 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/50 outline-none backdrop-blur-sm"
          />
          <button className="rounded-full bg-gold-400 px-4 py-2.5 text-sm font-semibold text-ink-950">
            Send
          </button>
        </div>

        {/* Tap zones */}
        <button onClick={tapLeft} className="absolute left-0 top-0 h-full w-1/3" />
        <button onClick={tapRight} className="absolute right-0 top-0 h-full w-1/3" />
      </motion.div>
    </motion.div>
  );
}
