import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { cancelAlarm as localCancelAlarm } from '../lib/sqlite';

export interface Alarm {
  id: string;
  group_id: string;
  created_by: string;
  title: string;
  alarm_time: string;
  is_recurring: boolean;
  recurrence_days?: number[];
  recurrence_end_date?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  sound_url?: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface AlarmCompletion {
  id: string;
  alarm_id: string;
  user_id: string;
  group_id: string;
  status: 'pending' | 'completed' | 'missed' | 'cancelled';
  completed_at?: string;
  attempts: number;
  challenge_difficulty?: string;
  user?: {
    full_name?: string;
    avatar_url?: string;
  };
}

interface AlarmState {
  alarms: Alarm[];
  completions: AlarmCompletion[];
  loading: boolean;
  realtimeChannel: RealtimeChannel | null;

  setAlarms: (alarms: Alarm[]) => void;
  setCompletions: (completions: AlarmCompletion[]) => void;
  setLoading: (loading: boolean) => void;

  fetchAlarms: (groupId: string) => Promise<void>;
  fetchCompletions: (alarmId: string) => Promise<void>;

  createAlarm: (alarmData: {
    group_id: string;
    title: string;
    alarm_time: string;
    difficulty: 'easy' | 'medium' | 'hard';
    sound_url?: string;
    is_recurring?: boolean;
    recurrence_days?: number[];
    recurrence_end_date?: string;
  }) => Promise<{ success: boolean; alarm_id?: string; error?: string }>;

  updateAlarm: (alarmData: {
    alarm_id: string;
    title?: string;
    alarm_time?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    sound_url?: string;
    is_recurring?: boolean;
    recurrence_days?: number[];
    recurrence_end_date?: string;
  }) => Promise<{ success: boolean; error?: string }>;

  deleteAlarm: (alarmId: string) => Promise<{ success: boolean; error?: string }>;
  
  completeChallenge: (
    alarmId: string, 
    status: 'completed' | 'missed', 
    completedAt?: string, 
    attempts?: number
  ) => Promise<{ success: boolean; offline?: boolean; wake_score?: number; current_streak?: number; error?: string }>;

  // Realtime
  subscribeToAlarms: (groupId: string) => void;
  unsubscribeFromAlarms: () => void;
}

export const useAlarmStore = create<AlarmState>((set, get) => ({
  alarms: [],
  completions: [],
  loading: false,
  realtimeChannel: null,

  setAlarms: (alarms) => set({ alarms }),
  setCompletions: (completions) => set({ completions }),
  setLoading: (loading) => set({ loading }),

  fetchAlarms: async (groupId) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('alarms')
        .select('*')
        .eq('group_id', groupId)
        .order('alarm_time', { ascending: true });

      if (error) throw error;
      set({ alarms: data || [] });
    } catch (err) {
      console.error('Failed to fetch alarms:', err);
    } finally {
      set({ loading: false });
    }
  },

  fetchCompletions: async (alarmId) => {
    try {
      const { data, error } = await supabase
        .from('alarm_completions')
        .select(`
          *,
          user:users (
            full_name,
            avatar_url
          )
        `)
        .eq('alarm_id', alarmId);

      if (error) throw error;
      set({ completions: data || [] });
    } catch (err) {
      console.error('Failed to fetch alarm completions:', err);
    }
  },

  createAlarm: async (alarmData) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-alarm', {
        body: alarmData,
      });

      if (error || !data.success) {
        return { success: false, error: data?.error || error?.message || 'Failed to create alarm' };
      }

      await get().fetchAlarms(alarmData.group_id);
      return { success: true, alarm_id: data.alarm_id };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  updateAlarm: async (alarmData) => {
    try {
      const { data, error } = await supabase.functions.invoke('update-alarm', {
        body: alarmData,
      });

      if (error || !data.success) {
        return { success: false, error: data?.error || error?.message || 'Failed to update alarm' };
      }

      // Refresh list
      const alarmRecord = get().alarms.find(a => a.id === alarmData.alarm_id);
      if (alarmRecord) {
        await get().fetchAlarms(alarmRecord.group_id);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  deleteAlarm: async (alarmId) => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-alarm', {
        body: { alarm_id: alarmId },
      });

      if (error || !data.success) {
        return { success: false, error: data?.error || error?.message || 'Failed to delete alarm' };
      }

      // Update locally
      set((state) => ({
        alarms: state.alarms.map((a) => a.id === alarmId ? { ...a, status: 'cancelled' } : a),
      }));

      // Unschedule local copy
      try {
        await localCancelAlarm(alarmId);
      } catch (err) {
        console.error('Failed to cancel local alarm in SQLite:', err);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
  
  completeChallenge: async (alarmId, status, completedAt, attempts) => {
    try {
      const { data, error } = await supabase.functions.invoke('complete-challenge', {
        body: {
          alarm_id: alarmId,
          status,
          completed_at: completedAt,
          attempts: attempts || 0
        },
      });

      if (error || !data.success) {
        throw new Error(data?.error || error?.message || 'Failed to post completion to server');
      }

      return { 
        success: true, 
        wake_score: data.wake_score, 
        current_streak: data.current_streak 
      };
    } catch (err: any) {
      console.warn('Network issue while saving completion, saving locally to queue...', err);
      
      // Return offline indicator so the client stores it in local SQLite queue
      return { 
        success: false, 
        offline: true, 
        error: err.message 
      };
    }
  },

  subscribeToAlarms: (groupId) => {
    get().unsubscribeFromAlarms();

    const channel = supabase
      .channel(`group:${groupId}:alarms`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alarms',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          console.log('Realtime alarm change received:', payload.eventType);
          get().fetchAlarms(groupId);
        }
      )
      .subscribe();

    set({ realtimeChannel: channel });
  },

  unsubscribeFromAlarms: () => {
    const channel = get().realtimeChannel;
    if (channel) {
      supabase.removeChannel(channel);
      set({ realtimeChannel: null });
    }
  },
}));
