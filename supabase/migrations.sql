-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. TABLE: users
-- ==========================================
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  plan_type text NOT NULL CHECK (plan_type IN ('free_trial', 'member', 'admin')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  revenuecat_user_id text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- ==========================================
-- 2. TABLE: user_subscriptions
-- ==========================================
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  plan_type text NOT NULL CHECK (plan_type IN ('member', 'admin')),
  status text NOT NULL CHECK (status IN ('active', 'expired', 'cancelled')),
  started_at timestamptz,
  expires_at timestamptz,
  revenuecat_product_id text,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- ==========================================
-- 3. TABLE: groups
-- ==========================================
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  admin_id uuid REFERENCES public.users(id) ON DELETE RESTRICT NOT NULL,
  invite_code text UNIQUE NOT NULL,
  default_sound_url text,
  member_count int DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  is_active boolean DEFAULT true NOT NULL
);

-- ==========================================
-- 4. TABLE: group_members
-- ==========================================
CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  joined_at timestamptz DEFAULT now() NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  wake_score numeric DEFAULT 0 NOT NULL CHECK (wake_score >= 0 AND wake_score <= 100),
  total_alarms_received int DEFAULT 0 NOT NULL CHECK (total_alarms_received >= 0),
  total_completed int DEFAULT 0 NOT NULL CHECK (total_completed >= 0),
  current_streak int DEFAULT 0 NOT NULL CHECK (current_streak >= 0),
  longest_streak int DEFAULT 0 NOT NULL CHECK (longest_streak >= 0),
  CONSTRAINT unique_group_member UNIQUE (group_id, user_id)
);

-- ==========================================
-- 5. TABLE: alarms
-- ==========================================
CREATE TABLE IF NOT EXISTS public.alarms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE RESTRICT NOT NULL,
  title text NOT NULL,
  alarm_time timestamptz NOT NULL,
  is_recurring boolean DEFAULT false NOT NULL,
  recurrence_days int[],
  recurrence_end_date date,
  difficulty text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  sound_url text,
  status text DEFAULT 'scheduled' NOT NULL CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- ==========================================
-- 6. TABLE: alarm_completions
-- ==========================================
CREATE TABLE IF NOT EXISTS public.alarm_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alarm_id uuid REFERENCES public.alarms(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'missed', 'cancelled')),
  completed_at timestamptz,
  attempts int DEFAULT 0 NOT NULL CHECK (attempts >= 0),
  challenge_difficulty text,
  CONSTRAINT unique_alarm_user UNIQUE (alarm_id, user_id)
);

-- ==========================================
-- 7. TABLE: device_tokens
-- ==========================================
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  fcm_token text NOT NULL,
  platform text DEFAULT 'android' NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  CONSTRAINT unique_user_platform UNIQUE (user_id, platform)
);

-- ==========================================
-- 8. TABLE: notifications
-- ==========================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb,
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_group_members_user ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_alarms_group ON public.alarms(group_id);
CREATE INDEX IF NOT EXISTS idx_alarm_completions_user ON public.alarm_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_alarm_completions_group ON public.alarm_completions(group_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON public.device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);

-- ==========================================
-- TRIGGERS & FUNCTIONS
-- ==========================================

-- Trigger A: copies auth.users to public.users on insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    full_name,
    avatar_url,
    plan_type,
    trial_started_at,
    trial_ends_at
  )
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    'free_trial',
    now(),
    now() + interval '3 days'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger B: updates groups.member_count on group_members change
CREATE OR REPLACE FUNCTION public.update_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_active = true THEN
      UPDATE public.groups
      SET member_count = member_count + 1
      WHERE id = NEW.group_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_active = false AND NEW.is_active = true THEN
      UPDATE public.groups
      SET member_count = member_count + 1
      WHERE id = NEW.group_id;
    ELSIF OLD.is_active = true AND NEW.is_active = false THEN
      UPDATE public.groups
      SET member_count = member_count - 1
      WHERE id = NEW.group_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.is_active = true THEN
      UPDATE public.groups
      SET member_count = member_count - 1
      WHERE id = OLD.group_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_group_member_change
  AFTER INSERT OR UPDATE OR DELETE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.update_member_count();

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alarms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alarm_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 1. users Policies
CREATE POLICY "Users can read own record" ON public.users
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can update own record" ON public.users
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 2. user_subscriptions Policies
CREATE POLICY "Users can view own subscriptions" ON public.user_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 3. groups Policies
CREATE POLICY "Members can view active groups" ON public.groups
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
      AND group_members.is_active = true
    )
    OR admin_id = auth.uid()
  );

-- 4. group_members Policies
CREATE POLICY "Users can view group members" ON public.group_members
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = group_members.group_id
      AND groups.admin_id = auth.uid()
    )
  );

-- 5. alarms Policies
CREATE POLICY "Members can view alarms for their group" ON public.alarms
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = alarms.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.is_active = true
    )
  );

-- 6. alarm_completions Policies
CREATE POLICY "Members can view own completions or admin can view group completions" ON public.alarm_completions
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = alarm_completions.group_id
      AND groups.admin_id = auth.uid()
    )
  );

-- 7. device_tokens Policies
CREATE POLICY "Users can manage own device tokens" ON public.device_tokens
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 8. notifications Policies
CREATE POLICY "Users can read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications read status" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
