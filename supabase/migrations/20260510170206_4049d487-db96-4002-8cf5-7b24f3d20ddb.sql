
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'brand', 'user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  wallet_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE TYPE public.proof_type AS ENUM ('screenshot', 'link', 'image', 'text');
CREATE TYPE public.campaign_status AS ENUM ('draft', 'active', 'paused', 'completed');
CREATE TYPE public.submission_status AS ENUM ('pending', 'ai_reviewing', 'approved', 'rejected', 'paid');

CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  instructions TEXT,
  proof_type public.proof_type NOT NULL DEFAULT 'screenshot',
  reward_amount NUMERIC(10,2) NOT NULL CHECK (reward_amount > 0),
  total_budget NUMERIC(10,2) NOT NULL CHECK (total_budget > 0),
  spent_budget NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_submissions INTEGER,
  status public.campaign_status NOT NULL DEFAULT 'active',
  cover_image_url TEXT,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proof_text TEXT,
  proof_url TEXT,
  proof_image_url TEXT,
  status public.submission_status NOT NULL DEFAULT 'pending',
  ai_relevance_score INTEGER,
  ai_quality_score INTEGER,
  ai_spam_score INTEGER,
  ai_confidence_score INTEGER,
  ai_feedback TEXT,
  rejection_reason TEXT,
  reward_paid NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

-- has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER campaigns_updated BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), NEW.raw_user_meta_data->>'avatar_url');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- profiles: anyone can read, owner can update
CREATE POLICY "Profiles viewable by all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- user_roles: users can view their own; admins all
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- campaigns
CREATE POLICY "Active campaigns viewable by all" ON public.campaigns FOR SELECT USING (status = 'active' OR auth.uid() = brand_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can create campaigns" ON public.campaigns FOR INSERT WITH CHECK (auth.uid() = brand_id);
CREATE POLICY "Brand updates own campaigns" ON public.campaigns FOR UPDATE USING (auth.uid() = brand_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Brand deletes own campaigns" ON public.campaigns FOR DELETE USING (auth.uid() = brand_id OR public.has_role(auth.uid(), 'admin'));

-- submissions
CREATE POLICY "View own submissions or as brand/admin" ON public.submissions FOR SELECT USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.brand_id = auth.uid())
);
CREATE POLICY "Users create own submissions" ON public.submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Brand or admin can update submissions" ON public.submissions FOR UPDATE USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.brand_id = auth.uid())
  OR auth.uid() = user_id
);

-- Storage bucket for proof uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('proofs', 'proofs', true);
CREATE POLICY "Proofs publicly viewable" ON storage.objects FOR SELECT USING (bucket_id = 'proofs');
CREATE POLICY "Authenticated upload proofs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'proofs' AND auth.role() = 'authenticated');
CREATE POLICY "Owner manages proof" ON storage.objects FOR UPDATE USING (bucket_id = 'proofs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owner deletes proof" ON storage.objects FOR DELETE USING (bucket_id = 'proofs' AND auth.uid()::text = (storage.foldername(name))[1]);
