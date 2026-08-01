-- Phase A: wallet address on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wallet_address TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_wallet_address_unique
  ON public.profiles (lower(wallet_address))
  WHERE wallet_address IS NOT NULL;

-- Phase B: campaign treasuries
CREATE TABLE IF NOT EXISTS public.campaign_treasuries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL,
  treasury_balance NUMERIC(20,6) NOT NULL DEFAULT 0,
  reserved_balance NUMERIC(20,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_id)
);

GRANT SELECT, INSERT, UPDATE ON public.campaign_treasuries TO authenticated;
GRANT ALL ON public.campaign_treasuries TO service_role;

ALTER TABLE public.campaign_treasuries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brands view own treasury"
  ON public.campaign_treasuries FOR SELECT
  TO authenticated
  USING (brand_id = auth.uid());

CREATE POLICY "Brands insert own treasury"
  ON public.campaign_treasuries FOR INSERT
  TO authenticated
  WITH CHECK (brand_id = auth.uid());

CREATE POLICY "Brands update own treasury"
  ON public.campaign_treasuries FOR UPDATE
  TO authenticated
  USING (brand_id = auth.uid())
  WITH CHECK (brand_id = auth.uid());

DO $$ BEGIN
  CREATE TYPE public.treasury_tx_kind AS ENUM ('fund','reserve','release','spend','refund');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.treasury_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treasury_id UUID NOT NULL REFERENCES public.campaign_treasuries(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  submission_id UUID REFERENCES public.submissions(id) ON DELETE SET NULL,
  kind public.treasury_tx_kind NOT NULL,
  amount NUMERIC(20,6) NOT NULL,
  tx_hash TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.treasury_transactions TO authenticated;
GRANT ALL ON public.treasury_transactions TO service_role;

ALTER TABLE public.treasury_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brands view own treasury tx"
  ON public.treasury_transactions FOR SELECT
  TO authenticated
  USING (brand_id = auth.uid());

CREATE POLICY "Brands insert own treasury tx"
  ON public.treasury_transactions FOR INSERT
  TO authenticated
  WITH CHECK (brand_id = auth.uid());

-- Phase C: claim status on submissions
DO $$ BEGIN
  CREATE TYPE public.claim_status AS ENUM ('unclaimed','claimable','claiming','paid','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS claim_status public.claim_status NOT NULL DEFAULT 'unclaimed',
  ADD COLUMN IF NOT EXISTS tx_hash TEXT,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.reward_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  amount NUMERIC(20,6) NOT NULL,
  wallet_address TEXT NOT NULL,
  tx_hash TEXT,
  status public.claim_status NOT NULL DEFAULT 'claiming',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE ON public.reward_claims TO authenticated;
GRANT ALL ON public.reward_claims TO service_role;

ALTER TABLE public.reward_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own claims"
  ON public.reward_claims FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own claims"
  ON public.reward_claims FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own claims"
  ON public.reward_claims FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER campaign_treasuries_set_updated_at
  BEFORE UPDATE ON public.campaign_treasuries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();