import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export interface FeedAuthor {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface FeedPost {
  id: string;
  user_id: string;
  content: string;
  visibility: 'public' | 'global' | 'private';
  created_at: string;
  profiles: FeedAuthor | null;
}

const FEED_SELECT = `
  id,
  user_id,
  content,
  visibility,
  created_at,
  profiles:user_id(id, full_name, avatar_url)
`;

function normalizePost(value: unknown): FeedPost {
  const row = value as Omit<FeedPost, 'profiles'> & { profiles: FeedAuthor | FeedAuthor[] | null };
  return {
    ...row,
    profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to load the feed.';
}

export function useFeed() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('posts')
        .select(FEED_SELECT)
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;
      setPosts((data ?? []).map(normalizePost));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let channel: RealtimeChannel | null = null;

    void loadFeed();

    channel = supabase
      .channel('orthodoxconnect-feed-posts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        async (payload) => {
          const insertedId = typeof payload.new.id === 'string' ? payload.new.id : null;
          if (!active || !insertedId) return;

          const { data, error: queryError } = await supabase
            .from('posts')
            .select(FEED_SELECT)
            .eq('id', insertedId)
            .single();

          if (!active) return;
          if (queryError) {
            setError(queryError.message);
            return;
          }

          const newPost = normalizePost(data);
          setPosts((current) => [newPost, ...current.filter((post) => post.id !== newPost.id)]);
        },
      )
      .subscribe((status) => {
        if (active && status === 'CHANNEL_ERROR') {
          setError('Live feed updates are temporarily unavailable.');
        }
      });

    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [loadFeed]);

  return useMemo(
    () => ({
      posts,
      loading,
      error,
      empty: !loading && !error && posts.length === 0,
      refetch: loadFeed,
    }),
    [error, loadFeed, loading, posts],
  );
}
