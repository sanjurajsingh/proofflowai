
-- 1) Enum: add 'queued'
ALTER TYPE public.submission_status ADD VALUE IF NOT EXISTS 'queued' BEFORE 'ai_reviewing';

-- 2) Profiles additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS trust_score INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS total_earned NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_submissions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_submissions INTEGER NOT NULL DEFAULT 0;

-- 3) Campaigns additions
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS cooldown_seconds INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS max_per_user INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS min_trust_score INTEGER NOT NULL DEFAULT 0;

-- 4) Submissions additions
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS submissions_unique_content_per_campaign
  ON public.submissions(campaign_id, content_hash)
  WHERE content_hash IS NOT NULL AND status <> 'rejected';

CREATE INDEX IF NOT EXISTS submissions_user_created_idx ON public.submissions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS submissions_status_idx ON public.submissions(status);

-- 5) Wallet transactions ledger
CREATE TYPE public.wallet_tx_kind AS ENUM ('earn','payout','refund','adjustment');

CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind public.wallet_tx_kind NOT NULL,
  amount NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  submission_id UUID,
  payout_request_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX wallet_tx_user_idx ON public.wallet_transactions(user_id, created_at DESC);

CREATE POLICY "Users view own wallet tx"
  ON public.wallet_transactions FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
-- No INSERT/UPDATE/DELETE policies → only service role writes.

-- 6) Payout requests
CREATE TYPE public.payout_status AS ENUM ('pending','approved','paid','rejected');

CREATE TABLE public.payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'manual',
  destination TEXT,
  status public.payout_status NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX payout_user_idx ON public.payout_requests(user_id, created_at DESC);

CREATE POLICY "Users view own payouts"
  ON public.payout_requests FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
-- writes via server only.

-- 7) Submission fingerprints
CREATE TABLE public.submission_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL,
  user_id UUID NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  device_hash TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.submission_fingerprints ENABLE ROW LEVEL SECURITY;
CREATE INDEX fp_user_idx ON public.submission_fingerprints(user_id, created_at DESC);
CREATE INDEX fp_ip_idx ON public.submission_fingerprints(ip_address);
CREATE INDEX fp_device_idx ON public.submission_fingerprints(device_hash);

CREATE POLICY "Admins view fingerprints"
  ON public.submission_fingerprints FOR SELECT
  USING (public.has_role(auth.uid(),'admin'));

-- 8) Disposable email blocklist
CREATE TABLE public.disposable_email_domains (
  domain TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.disposable_email_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read disposable list"
  ON public.disposable_email_domains FOR SELECT USING (true);
CREATE POLICY "Admins manage disposable list"
  ON public.disposable_email_domains FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.disposable_email_domains (domain) VALUES
  ('mailinator.com'),('guerrillamail.com'),('tempmail.com'),('10minutemail.com'),
  ('yopmail.com'),('trashmail.com'),('throwawaymail.com'),('fakeinbox.com'),
  ('getnada.com'),('maildrop.cc'),('sharklasers.com'),('dispostable.com'),
  ('tempmailo.com'),('mintemail.com'),('emailondeck.com'),('temp-mail.org'),
  ('mohmal.com'),('mailnesia.com'),('mailcatch.com'),('inboxbear.com')
  ON CONFLICT DO NOTHING;

-- 9) Trigger: protect financial profile fields from client tampering
CREATE OR REPLACE FUNCTION public.protect_profile_finance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- auth.uid() is non-null only for client (anon/authenticated) requests.
  -- Service role calls have no JWT, so this protection only fires for clients.
  IF auth.uid() IS NOT NULL THEN
    IF NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance
       OR NEW.trust_score IS DISTINCT FROM OLD.trust_score
       OR NEW.total_earned IS DISTINCT FROM OLD.total_earned
       OR NEW.total_submissions IS DISTINCT FROM OLD.total_submissions
       OR NEW.approved_submissions IS DISTINCT FROM OLD.approved_submissions
       OR NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Financial / trust fields can only be modified server-side';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_profile_finance_trg ON public.profiles;
CREATE TRIGGER protect_profile_finance_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_finance();

-- 10) Update handle_new_user to also store email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill emails for existing profiles
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- 11) Storage: make proofs bucket private + scoped policies
UPDATE storage.buckets SET public = false WHERE id = 'proofs';

DROP POLICY IF EXISTS "Proofs upload own folder" ON storage.objects;
DROP POLICY IF EXISTS "Proofs read own files" ON storage.objects;
DROP POLICY IF EXISTS "Proofs admin read" ON storage.objects;
DROP POLICY IF EXISTS "Proofs public read" ON storage.objects;

CREATE POLICY "Proofs upload own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Proofs read own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'proofs'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(),'admin')
    )
  );
