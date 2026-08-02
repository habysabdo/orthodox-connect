import { supabase } from '../lib/supabase';
import type { Post } from '../types';

export async function loadPosts(
  groupId: string | null = null,
  options: { limit?: number; before?: number } = {}
): Promise<Post[]> {
  try {
    let query = supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (groupId) {
      query = query.eq('group_id', groupId);
    } else {
      query = query.is('group_id', null);
    }

    if (options.before) {
      query = query.lt('created_at', new Date(options.before).toISOString());
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      authorId: row.author_id,
      text: row.text || '',
      image: row.image || undefined,
      video: row.video || undefined,
      createdAt: new Date(row.created_at).getTime(),
      likes: row.likes || [],
      comments: row.comments || [],
      groupId: row.group_id || null,
    }));
  } catch {
    return [];
  }
}

export async function loadPostsByAuthor(authorId: string): Promise<Post[]> {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('author_id', authorId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      authorId: row.author_id,
      text: row.text || '',
      image: row.image || undefined,
      video: row.video || undefined,
      createdAt: new Date(row.created_at).getTime(),
      likes: row.likes || [],
      comments: row.comments || [],
      groupId: row.group_id || null,
    }));
  } catch {
    return [];
  }
}

export async function savePost(post: Post): Promise<boolean> {
  try {
    const { error } = await supabase.from('posts').upsert({
      id: post.id,
      author_id: post.authorId,
      text: post.text,
      image: post.image || null,
      video: post.video || null,
      created_at: new Date(post.createdAt).toISOString(),
      likes: post.likes || [],
      comments: post.comments || [],
      group_id: post.groupId || null,
    });
    return !error;
  } catch {
    return false;
  }
}

export async function loadPost(postId: string): Promise<Post> {
  const { data } = await supabase.from('posts').select('*').eq('id', postId).single();
  if (!data) throw new Error('Post not found');

  return {
    id: data.id,
    authorId: data.author_id,
    text: data.text || '',
    image: data.image || undefined,
    video: data.video || undefined,
    createdAt: new Date(data.created_at).getTime(),
    likes: data.likes || [],
    comments: data.comments || [],
    groupId: data.group_id || null,
  };
}

export async function deletePost(postId: string): Promise<boolean> {
  const { error } = await supabase.from('posts').delete().eq('id', postId);
  return !error;
}

export async function createReshare(
  postId: string,
  kind: string,
  quote: string
): Promise<Post> {
  const original = await loadPost(postId);
  const resharedPost: Post = {
    id: `p_${Date.now()}`,
    authorId: original.authorId,
    text: quote || original.text,
    createdAt: Date.now(),
    likes: [],
    comments: [],
    groupId: original.groupId,
    originalPost: original,
  };
  await savePost(resharedPost);
  return resharedPost;
}
