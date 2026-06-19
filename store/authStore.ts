import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  plan_type: 'free_trial' | 'member' | 'admin';
  trial_started_at?: string;
  trial_ends_at?: string;
  revenuecat_user_id?: string;
  created_at: string;
}

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  entitlements: Record<string, any>;
  loading: boolean;
  mockEntitlementsEnabled: boolean;
  mockEntitlements: Record<string, boolean>;
  
  setSession: (session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setUser: (user: User | null) => void;
  setEntitlements: (entitlements: Record<string, any>) => void;
  setLoading: (loading: boolean) => void;
  
  // Debug mock features to bypass billing in testing
  toggleMockEntitlements: (enabled: boolean) => void;
  setMockEntitlements: (mocks: Record<string, boolean>) => void;
  
  signOut: () => Promise<void>;
  
  // Getters
  isAdmin: () => boolean;
  isMember: () => boolean;
  isOnTrial: () => boolean;
  canCreateGroups: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  session: null,
  entitlements: {},
  loading: true,
  mockEntitlementsEnabled: false,
  mockEntitlements: {
    wakeit_admin: false,
    wakeit_member: false,
  },

  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setUser: (user) => set({ user }),
  setEntitlements: (entitlements) => set({ entitlements }),
  setLoading: (loading) => set({ loading }),

  toggleMockEntitlements: (enabled) => set({ mockEntitlementsEnabled: enabled }),
  setMockEntitlements: (mocks) => set((state) => ({ 
    mockEntitlements: { ...state.mockEntitlements, ...mocks } 
  })),

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null, session: null, entitlements: {} });
  },

  isAdmin: () => {
    const { mockEntitlementsEnabled, mockEntitlements, entitlements, profile } = get();
    if (mockEntitlementsEnabled) {
      return !!mockEntitlements['wakeit_admin'];
    }
    return !!entitlements['wakeit_admin'] || profile?.plan_type === 'admin';
  },

  isMember: () => {
    const { mockEntitlementsEnabled, mockEntitlements, entitlements, profile } = get();
    if (mockEntitlementsEnabled) {
      return !!mockEntitlements['wakeit_member'] || !!mockEntitlements['wakeit_admin'];
    }
    return !!entitlements['wakeit_member'] || !!entitlements['wakeit_admin'] || profile?.plan_type === 'member' || profile?.plan_type === 'admin';
  },

  isOnTrial: () => {
    const { profile } = get();
    if (!profile) return false;
    return (
      profile.plan_type === 'free_trial' &&
      profile.trial_ends_at !== undefined &&
      new Date(profile.trial_ends_at) > new Date()
    );
  },

  canCreateGroups: () => {
    return get().isAdmin() || get().isOnTrial();
  }
}));
