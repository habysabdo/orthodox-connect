import { supabase } from '@/lib/supabase';
import type { Post } from '@/types';

interface SupabasePostRow {
  id: string;
  content: string;
  author_name: string;
  author_id: string;
  image_url: string | null;
  created_at: string;
}

function mapRow(row: SupabasePostRow): Post {
  return {
    id: row.id,
    text: row.content,
    authorName: row.author_name,
    authorId: row.author_id,
    image: row.image_url ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
    likes: [],
    comments: [],
  };
}

export async function loadPosts(): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('id, content, author_name, author_id, image_url, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data) return [];
  return (data as SupabasePostRow[]).map(mapRow);
}

export async function loadReels(): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('id, content, author_name, author_id, image_url, created_at')
    .not('image_url', 'is', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data) return [];
  return (data as SupabasePostRow[]).map(mapRow);
}

export async function createPostInDb(input: {
  text: string;
  authorName: string;
  authorId: string;
  image?: string;
}): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      content: input.text,
      author_name: input.authorName,
      author_id: input.authorId,
      image_url: input.image ?? null,
    })
    .select('id, content, author_name, author_id, image_url, created_at')
    .single();

  if (error) throw error;
  if (!data) return null;
  return mapRow(data as SupabasePostRow);
}
