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
      authorId: row.author_id || row.id,
      authorName: row.author_name || 'Anonymous',
      authorParish: row.author_parish || '',
      authorAvatar: row.author_avatar || '',
      text: row.content || row.text || '',
      image: row.image_url || row.image || undefined,
      video: row.video || undefined,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
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
      authorId: row.author_id || row.id,
      authorName: row.author_name || 'Anonymous',
      authorParish: row.author_parish || '',
      authorAvatar: row.author_avatar || '',
      text: row.content || row.text || '',
      image: row.image_url || row.image || undefined,
      video: row.video || undefined,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      likes: row.likes || [],
      comments: row.comments || [],
      groupId: row.group_id || null,
    }));
  } catch {
    return [];
  }
}

export async function loadReels(): Promise<Post[]> {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .not('video', 'is', null)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      authorId: row.author_id || row.id,
      authorName: row.author_name || 'Anonymous',
      authorParish: row.author_parish || '',
      authorAvatar: row.author_avatar || '',
      text: row.content || row.text || '',
      image: row.image_url || row.image || undefined,
      video: row.video || undefined,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
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
      author_name: post.authorName,
      author_parish: post.authorParish,
      author_avatar: post.authorAvatar,
      content: post.text,
      image_url: post.image || null,
      video: post.video || null,
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
    authorId: data.author_id || data.id,
    authorName: data.author_name || 'Anonymous',
    authorParish: data.author_parish || '',
    authorAvatar: data.author_avatar || '',
    text: data.content || data.text || '',
    image: data.image_url || data.image || undefined,
    video: data.video || undefined,
    createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
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
