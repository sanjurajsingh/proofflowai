
-- 1. Wipe all public data for a fresh start
TRUNCATE TABLE
  public.reward_claims,
  public.treasury_transactions,
  public.campaign_treasuries,
  public.submission_fingerprints,
  public.wallet_transactions,
  public.payout_requests,
  public.submissions,
  public.campaigns,
  public.user_roles,
  public.profiles
RESTART IDENTITY CASCADE;

-- 2. Remove the email-based new-user trigger (wallet flow handles profile creation)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Extend campaign_status enum
ALTER TYPE public.campaign_status ADD VALUE IF NOT EXISTS 'pending_review' BEFORE 'active';

-- 4. Expand campaigns table
ALTER TABLE public.campaigns
  ALTER COLUMN status SET DEFAULT 'draft'::campaign_status,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS start_at timestamptz,
  ADD COLUMN IF NOT EXISTS end_at timestamptz,
  ADD COLUMN IF NOT EXISTS required_proof_types text[] NOT NULL DEFAULT '{screenshot}',
  ADD COLUMN IF NOT EXISTS required_keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS min_text_length integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allowed_domains text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS forbidden_domains text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS auto_approve_threshold integer NOT NULL DEFAULT 85,
  ADD COLUMN IF NOT EXISTS manual_review_threshold integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS reject_threshold integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS geo_restrictions text[] NOT NULL DEFAULT '{}';

-- 5. Profiles: relax insert so wallet-first onboarding can create rows
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Ensure SELECT/UPDATE policies still exist (they do, but make idempotent)
-- Also explicitly grant for anonymous (anon) read of public columns
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- 6. Drop email column from profiles (no longer used)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;
