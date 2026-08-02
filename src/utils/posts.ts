import { supabase } from '@/lib/supabase';
import type { Post } from '@/types';

interface SupabasePostRow {
  id: string;
  content: string;
  author_name: string;
  author_id: string;
  author_parish: string | null;
  author_avatar: string | null;
  image_url: string | null;
  created_at: string;
}

function mapRow(row: SupabasePostRow): Post {
  return {
    id: row.id,
    text: row.content,
    authorName: row.author_name,
    authorId: row.author_id,
    authorParish: row.author_parish ?? undefined,
    authorAvatar: row.author_avatar ?? undefined,
    image: row.image_url ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
    likes: [],
    comments: [],
  };
}

const SELECT_COLUMNS = 'id, content, author_name, author_id, author_parish, author_avatar, image_url, created_at';

export async function loadPosts(): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(SELECT_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data) return [];
  return (data as SupabasePostRow[]).map(mapRow);
}

export async function loadReels(): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(SELECT_COLUMNS)
    .not('image_url', 'is', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data) return [];
  return (data as SupabasePostRow[]).map(mapRow);
}

export async function loadPostsByAuthor(authorId: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(SELECT_COLUMNS)
    .eq('author_id', authorId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data) return [];
  return (data as SupabasePostRow[]).map(mapRow);
}

export async function createPostInDb(input: {
  text: string;
  authorName: string;
  authorId: string;
  authorParish?: string;
  authorAvatar?: string;
  image?: string;
}): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      content: input.text,
      author_name: input.authorName,
      author_id: input.authorId,
      author_parish: input.authorParish ?? null,
      author_avatar: input.authorAvatar ?? null,
      image_url: input.image ?? null,
    })
    .select(SELECT_COLUMNS)
    .single();

  if (error) throw error;
  if (!data) return null;
  return mapRow(data as SupabasePostRow);
}
