import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Group {
  id: string;
  name: string;
  description?: string;
  admin_id: string;
  invite_code: string;
  default_sound_url?: string;
  member_count: number;
  created_at: string;
  is_active: boolean;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
  is_active: boolean;
  wake_score: number;
  total_alarms_received: number;
  total_completed: number;
  current_streak: number;
  longest_streak: number;
  // Joined user profile fields
  user?: {
    full_name?: string;
    avatar_url?: string;
    email: string;
  };
}

interface GroupState {
  groups: Group[];
  selectedGroupId: string | null;
  members: GroupMember[];
  loading: boolean;
  realtimeChannel: RealtimeChannel | null;
  membershipChannel: RealtimeChannel | null;

  setGroups: (groups: Group[]) => void;
  setSelectedGroupId: (id: string | null) => void;
  setMembers: (members: GroupMember[]) => void;
  setLoading: (loading: boolean) => void;

  fetchGroups: () => Promise<void>;
  fetchMembers: (groupId: string) => Promise<void>;
  
  createGroup: (name: string, description?: string, defaultSoundUrl?: string) => Promise<{ success: boolean; group_id?: string; invite_code?: string; error?: string }>;
  joinGroup: (inviteCode: string) => Promise<{ success: boolean; group_id?: string; group_name?: string; error?: string }>;
  removeMember: (groupId: string, userId: string) => Promise<{ success: boolean; error?: string }>;

  // Realtime
  subscribeToCompletions: (groupId: string) => void;
  unsubscribeFromCompletions: () => void;
  subscribeToGroupMemberships: (userId: string) => void;
  unsubscribeFromGroupMemberships: () => void;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  selectedGroupId: null,
  members: [],
  loading: false,
  realtimeChannel: null,
  membershipChannel: null,

  setGroups: (groups) => set({ groups }),
  setSelectedGroupId: (id) => set({ selectedGroupId: id }),
  setMembers: (members) => set({ members }),
  setLoading: (loading) => set({ loading }),

  fetchGroups: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ groups: data || [] });
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    } finally {
      set({ loading: false });
    }
  },

  fetchMembers: async (groupId) => {
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          *,
          user:users (
            full_name,
            avatar_url,
            email
          )
        `)
        .eq('group_id', groupId)
        .eq('is_active', true);

      if (error) throw error;
      set({ members: data || [] });
    } catch (err) {
      console.error('Failed to fetch group members:', err);
    }
  },

  createGroup: async (name, description, defaultSoundUrl) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-group', {
        body: { name, description, default_sound_url: defaultSoundUrl },
      });

      if (error || !data.success) {
        return { success: false, error: data?.error || error?.message || 'Failed to create group' };
      }

      await get().fetchGroups();
      return { success: true, group_id: data.group_id, invite_code: data.invite_code };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  joinGroup: async (inviteCode) => {
    try {
      const { data, error } = await supabase.functions.invoke('join-group', {
        body: { invite_code: inviteCode },
      });

      if (error || !data.success) {
        return { success: false, error: data?.error || error?.message || 'Failed to join group' };
      }

      await get().fetchGroups();
      return { success: true, group_id: data.group_id, group_name: data.group_name };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  removeMember: async (groupId, userId) => {
    try {
      const { data, error } = await supabase.functions.invoke('remove-member', {
        body: { group_id: groupId, user_id: userId },
      });

      if (error || !data.success) {
        return { success: false, error: data?.error || error?.message || 'Failed to remove member' };
      }

      // Update members list locally
      set((state) => ({
        members: state.members.filter((m) => m.user_id !== userId),
      }));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  subscribeToCompletions: (groupId) => {
    // Unsubscribe from any previous channels
    get().unsubscribeFromCompletions();

    const channel = supabase
      .channel(`group:${groupId}:realtime`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alarm_completions',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          console.log('Realtime completion update received:', payload);
          get().fetchMembers(groupId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_members',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          console.log('Realtime group member update received:', payload);
          get().fetchMembers(groupId);
        }
      )
      .subscribe();

    set({ realtimeChannel: channel });
  },

  unsubscribeFromCompletions: () => {
    const channel = get().realtimeChannel;
    if (channel) {
      supabase.removeChannel(channel);
      set({ realtimeChannel: null });
    }
  },

  subscribeToGroupMemberships: (userId) => {
    get().unsubscribeFromGroupMemberships();

    const channel = supabase
      .channel(`user:${userId}:memberships`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'group_members',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          console.log('Realtime group member update received:', payload.new);
          const updatedMember = payload.new as GroupMember;
          
          if (updatedMember.is_active === false) {
            console.log(`User was removed from group ${updatedMember.group_id}. Cleaning up local alarms...`);
            try {
              const { deleteAlarmsForGroup } = await import('../lib/sqlite');
              await deleteAlarmsForGroup(updatedMember.group_id);
            } catch (err) {
              console.error('Failed to clean up group alarms on membership deactivation:', err);
            }
            
            // Refresh groups list
            await get().fetchGroups();
          }
        }
      )
      .subscribe();

    set({ membershipChannel: channel });
  },

  unsubscribeFromGroupMemberships: () => {
    const channel = get().membershipChannel;
    if (channel) {
      supabase.removeChannel(channel);
      set({ membershipChannel: null });
    }
  },
}));
