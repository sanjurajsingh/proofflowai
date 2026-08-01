
ALTER TABLE public.reward_claims
  ADD COLUMN IF NOT EXISTS voucher_nonce text,
  ADD COLUMN IF NOT EXISTS voucher_deadline bigint,
  ADD COLUMN IF NOT EXISTS voucher_signature text,
  ADD COLUMN IF NOT EXISTS voucher_issued_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS reward_claims_unique_submission
  ON public.reward_claims (submission_id);

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS funding_tx_hash text,
  ADD COLUMN IF NOT EXISTS funded_at timestamptz;

-- Sybil: one submission per (campaign, wallet) hard enforced
CREATE UNIQUE INDEX IF NOT EXISTS submissions_one_per_user_per_campaign
  ON public.submissions (campaign_id, user_id)
  WHERE status <> 'rejected';
