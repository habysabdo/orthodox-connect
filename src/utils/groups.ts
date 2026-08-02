import { supabase } from '../lib/supabase';
import type { DiscoverableGroup, Group } from '../types';

export async function loadGroups(): Promise<Group[]> {
  try {
    const { data, error } = await supabase.from('groups').select('*');
    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      icon: row.icon || 'Users',
      membersCount: row.members_count || 1,
    }));
  } catch {
    return [];
  }
}

export async function discoverGroups(): Promise<DiscoverableGroup[]> {
  try {
    const { data, error } = await supabase.from('groups').select('*');
    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      icon: row.icon || 'Users',
      membersCount: row.members_count || 1,
      isMember: false,
    }));
  } catch {
    return [];
  }
}

export async function joinGroupRemote(groupId: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('join_group', { group_id_param: groupId });
    if (error) {
      // Fallback update if RPC is missing
      const { data } = await supabase.from('groups').select('members_count').eq('id', groupId).single();
      if (data) {
        await supabase
          .from('groups')
          .update({ members_count: (data.members_count || 0) + 1 })
          .eq('id', groupId);
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function createGroupRemote(name: string, description: string): Promise<Group> {
  const newGroup: Group = {
    id: `g_${Date.now()}`,
    name,
    description,
    icon: 'Users',
    membersCount: 1,
  };

  await supabase.from('groups').insert({
    id: newGroup.id,
    name: newGroup.name,
    description: newGroup.description,
    icon: newGroup.icon,
    members_count: 1,
  });

  return newGroup;
}
