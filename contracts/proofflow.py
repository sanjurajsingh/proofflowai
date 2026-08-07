# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""
ProofFlow AI — native GenLayer Intelligent Contract.

Campaigns, proof submissions, AI verification, worker balances, trust scores and
payout requests all live in contract state. AI verification runs inside a
non-deterministic block and is settled by the Equivalence Principle
(`gl.eq_principle.prompt_comparative`), so no server holds an API key and no
validator has to trust the leader's verdict.

All amounts are integer wei of native GEN. Images stay off-chain (Supabase
private bucket); only their storage path and a content hash are recorded here.
"""

import json
from dataclasses import dataclass
from datetime import datetime, timezone

from genlayer import *


STATUS_PENDING = "pending"
STATUS_APPROVED = "approved"
STATUS_REJECTED = "rejected"
STATUS_REVIEW = "review"

PAYOUT_PENDING = "pending"
PAYOUT_PAID = "paid"
PAYOUT_REJECTED = "rejected"

DEFAULT_TRUST = 50
MAX_EVIDENCE_CHARS = 4000


@allow_storage
@dataclass
class Campaign:
    id: u256
    owner: Address
    title: str
    description: str
    instructions: str
    proof_type: str
    category: str
    cover_image_path: str
    reward: u256
    budget: u256
    funded: u256
    spent: u256
    max_per_user: u256
    cooldown_seconds: u256
    min_trust: u256
    min_text_length: u256
    required_keywords: str
    active: bool
    created_at: u256


@allow_storage
@dataclass
class Submission:
    id: u256
    campaign_id: u256
    worker: Address
    proof_url: str
    proof_text: str
    image_path: str
    content_hash: str
    status: str
    relevance: u256
    quality: u256
    spam: u256
    confidence: u256
    feedback: str
    reward_paid: u256
    created_at: u256
    reviewed_at: u256


@allow_storage
@dataclass
class LedgerEntry:
    id: u256
    worker: Address
    kind: str
    amount: u256
    balance_after: u256
    submission_id: u256
    note: str
    created_at: u256


@allow_storage
@dataclass
class PayoutRequest:
    id: u256
    worker: Address
    amount: u256
    destination: str
    status: str
    note: str
    created_at: u256


class CampaignCreated(gl.Event):
    # Fields before `/` are indexed topics; everything else travels in the blob.
    def __init__(self, campaign_id: u256, /, **blob):
        pass


class CampaignFunded(gl.Event):
    def __init__(self, campaign_id: u256, /, **blob):
        pass


class ProofVerified(gl.Event):
    def __init__(self, submission_id: u256, /, **blob):
        pass


class RewardCredited(gl.Event):
    def __init__(self, worker: Address, /, **blob):
        pass


class PayoutRequested(gl.Event):
    def __init__(self, payout_id: u256, /, **blob):
        pass



class ProofFlow(gl.Contract):
    admin: Address
    campaigns: DynArray[Campaign]
    submissions: DynArray[Submission]
    ledger: DynArray[LedgerEntry]
    payouts: DynArray[PayoutRequest]

    balances: TreeMap[Address, u256]
    total_earned: TreeMap[Address, u256]
    trust: TreeMap[Address, u256]
    approved_count: TreeMap[Address, u256]
    submission_count: TreeMap[Address, u256]
    last_submission_at: TreeMap[Address, u256]
    per_campaign_count: TreeMap[str, u256]
    seen_hashes: TreeMap[str, bool]

    def __init__(self):
        self.admin = gl.message.sender_address

    # ------------------------------------------------------------------ utils

    def _now(self) -> int:
        # Time inside GenVM is pinned to the transaction timestamp, so this is
        # identical on every validator.
        return int(datetime.now(timezone.utc).timestamp())

    def _campaign(self, campaign_id: int) -> Campaign:
        if campaign_id < 0 or campaign_id >= len(self.campaigns):
            raise gl.vm.UserError("Unknown campaign")
        return self.campaigns[campaign_id]

    def _trust_of(self, addr: Address) -> int:
        return int(self.balances_default(self.trust, addr, DEFAULT_TRUST))

    def balances_default(self, m: TreeMap[Address, u256], addr: Address, fb: int) -> int:
        if addr in m:
            return int(m[addr])
        return fb

    def _credit(self, worker: Address, amount: int, submission_id: int, note: str) -> int:
        current = self.balances_default(self.balances, worker, 0)
        new_balance = current + amount
        self.balances[worker] = u256(new_balance)
        self.total_earned[worker] = u256(
            self.balances_default(self.total_earned, worker, 0) + amount
        )
        self.ledger.append(
            LedgerEntry(
                id=u256(len(self.ledger)),
                worker=worker,
                kind="earn",
                amount=u256(amount),
                balance_after=u256(new_balance),
                submission_id=u256(submission_id),
                note=note,
                created_at=u256(self._now()),
            )
        )
        RewardCredited(worker, amount=u256(amount)).emit()
        return new_balance

    def _require_owner_or_admin(self, campaign: Campaign) -> None:
        sender = gl.message.sender_address
        if sender != campaign.owner and sender != self.admin:
            raise gl.vm.UserError("Not authorised for this campaign")

    # ----------------------------------------------------------- campaign ops

    @gl.public.write
    def create_campaign(
        self,
        title: str,
        description: str,
        instructions: str,
        proof_type: str,
        category: str,
        cover_image_path: str,
        reward: int,
        budget: int,
        max_per_user: int,
        cooldown_seconds: int,
        min_trust: int,
        min_text_length: int,
        required_keywords: str,
    ) -> int:
        if len(title.strip()) < 3:
            raise gl.vm.UserError("Title too short")
        if reward <= 0:
            raise gl.vm.UserError("Reward must be positive")
        if budget < reward:
            raise gl.vm.UserError("Budget must cover at least one reward")
        if max_per_user <= 0:
            raise gl.vm.UserError("max_per_user must be positive")

        campaign_id = len(self.campaigns)
        self.campaigns.append(
            Campaign(
                id=u256(campaign_id),
                owner=gl.message.sender_address,
                title=title,
                description=description,
                instructions=instructions,
                proof_type=proof_type,
                category=category,
                cover_image_path=cover_image_path,
                reward=u256(reward),
                budget=u256(budget),
                funded=u256(0),
                spent=u256(0),
                max_per_user=u256(max_per_user),
                cooldown_seconds=u256(cooldown_seconds),
                min_trust=u256(min_trust),
                min_text_length=u256(min_text_length),
                required_keywords=required_keywords,
                active=False,
                created_at=u256(self._now()),
            )
        )
        CampaignCreated(u256(campaign_id), owner=gl.message.sender_address).emit()
        return campaign_id

    @gl.public.write.payable
    def fund_campaign(self, campaign_id: int) -> int:
        campaign = self._campaign(campaign_id)
        amount = int(gl.message.value)
        if amount <= 0:
            raise gl.vm.UserError("Send GEN with this transaction to fund the campaign")
        funded = int(campaign.funded) + amount
        campaign.funded = u256(funded)
        if funded >= int(campaign.reward):
            campaign.active = True
        CampaignFunded(u256(campaign_id), amount=u256(amount)).emit()
        return funded

    @gl.public.write
    def set_campaign_active(self, campaign_id: int, active: bool) -> None:
        campaign = self._campaign(campaign_id)
        self._require_owner_or_admin(campaign)
        if active and int(campaign.funded) < int(campaign.reward):
            raise gl.vm.UserError("Fund the campaign before activating it")
        campaign.active = active

    # --------------------------------------------------------- AI verification

    def _verify(self, campaign: Campaign, submission: Submission) -> dict:
        """Non-deterministic verification settled by the Equivalence Principle."""
        title = campaign.title
        description = campaign.description
        instructions = campaign.instructions
        proof_type = campaign.proof_type
        keywords = campaign.required_keywords
        proof_url = submission.proof_url
        proof_text = submission.proof_text
        has_image = submission.image_path != ""

        def judge() -> str:
            evidence = ""
            if proof_url != "":
                page = gl.nondet.web.render(proof_url, mode="text")
                evidence = str(page)[:MAX_EVIDENCE_CHARS]

            task = f"""
You are verifying a proof-of-work submission for a paid micro-task campaign.

CAMPAIGN
Title: {title}
Description: {description}
Instructions: {instructions}
Expected proof type: {proof_type}
Required keywords (may be empty): {keywords}

SUBMISSION
Text: {proof_text}
Link: {proof_url}
Screenshot attached: {has_image}
Content fetched from the link (may be empty):
{evidence}

Judge whether the submission genuinely completes the task. Penalise
irrelevant, empty, copy-pasted, spammy or fabricated proof.

Respond in JSON only:
{{
    "relevance": int,      // 0-100, how well the proof matches the task
    "quality": int,        // 0-100, effort and clarity
    "spam": int,           // 0-100, likelihood this is spam or fake
    "confidence": int,     // 0-100, your confidence in this judgement
    "recommendation": str, // one of "approve", "reject", "review"
    "feedback": str        // one short sentence for the worker
}}
It is mandatory that you respond only using the JSON format above, nothing
else. Do not include any prefix, suffix or formatting characters. The output
must be parsable by a JSON parser without errors.
"""
            result = gl.nondet.exec_prompt(task, response_format="json")
            return json.dumps(result, sort_keys=True)

        # Validators re-run the judgement themselves and an LLM decides whether
        # the two verdicts are equivalent. Numeric scores may drift slightly;
        # the recommendation must match.
        principle = (
            "Both outputs are JSON verdicts on the same submission. They are "
            "equivalent if the 'recommendation' field is identical and each of "
            "relevance, quality, spam and confidence differ by at most 15 "
            "points. The 'feedback' wording may differ completely and must be "
            "ignored."
        )
        raw = gl.eq_principle.prompt_comparative(judge, principle)
        return json.loads(str(raw))

    @gl.public.write
    def submit_proof(
        self,
        campaign_id: int,
        proof_url: str,
        proof_text: str,
        image_path: str,
        content_hash: str,
    ) -> int:
        campaign = self._campaign(campaign_id)
        worker = gl.message.sender_address
        now = self._now()

        if not campaign.active:
            raise gl.vm.UserError("Campaign is not active")
        if worker == campaign.owner:
            raise gl.vm.UserError("Brands cannot submit to their own campaign")

        reward = int(campaign.reward)
        if int(campaign.spent) + reward > int(campaign.funded):
            raise gl.vm.UserError("Campaign is out of funds")

        trust = self._trust_of(worker)
        if trust < int(campaign.min_trust):
            raise gl.vm.UserError("Trust score too low for this campaign")

        cooldown = int(campaign.cooldown_seconds)
        if worker in self.last_submission_at:
            elapsed = now - int(self.last_submission_at[worker])
            if elapsed < cooldown:
                raise gl.vm.UserError(f"Cooldown active, wait {cooldown - elapsed}s")

        cap_key = f"{campaign_id}:{worker.as_hex}"
        used = int(self.per_campaign_count.get(cap_key, 0))
        if used >= int(campaign.max_per_user):
            raise gl.vm.UserError("Submission limit reached for this campaign")

        if len(proof_text.strip()) < int(campaign.min_text_length):
            raise gl.vm.UserError("Proof text is too short for this campaign")
        if proof_url == "" and proof_text.strip() == "" and image_path == "":
            raise gl.vm.UserError("Provide a link, text or screenshot")

        if content_hash != "":
            dup_key = f"{campaign_id}:{content_hash}"
            if self.seen_hashes.get(dup_key, False):
                raise gl.vm.UserError("This proof was already submitted to this campaign")
            self.seen_hashes[dup_key] = True

        submission_id = len(self.submissions)
        submission = Submission(
            id=u256(submission_id),
            campaign_id=u256(campaign_id),
            worker=worker,
            proof_url=proof_url,
            proof_text=proof_text,
            image_path=image_path,
            content_hash=content_hash,
            status=STATUS_PENDING,
            relevance=u256(0),
            quality=u256(0),
            spam=u256(0),
            confidence=u256(0),
            feedback="",
            reward_paid=u256(0),
            created_at=u256(now),
            reviewed_at=u256(0),
        )
        self.submissions.append(submission)
        self.per_campaign_count[cap_key] = u256(used + 1)
        self.submission_count[worker] = u256(
            self.balances_default(self.submission_count, worker, 0) + 1
        )
        self.last_submission_at[worker] = u256(now)

        verdict = self._verify(campaign, self.submissions[submission_id])

        relevance = max(0, min(100, int(verdict.get("relevance", 0))))
        quality = max(0, min(100, int(verdict.get("quality", 0))))
        spam = max(0, min(100, int(verdict.get("spam", 100))))
        confidence = max(0, min(100, int(verdict.get("confidence", 0))))
        recommendation = str(verdict.get("recommendation", STATUS_REVIEW))
        feedback = str(verdict.get("feedback", ""))[:500]

        if recommendation == "approve":
            status = STATUS_APPROVED
        elif recommendation == "reject":
            status = STATUS_REJECTED
        else:
            status = STATUS_REVIEW

        # Trust-aware adjustments, mirroring the original review policy.
        if status == STATUS_REVIEW and trust >= 75 and spam < 25 and confidence >= 60:
            status = STATUS_APPROVED
        if status == STATUS_APPROVED and trust < 25:
            status = STATUS_REVIEW

        stored = self.submissions[submission_id]
        stored.relevance = u256(relevance)
        stored.quality = u256(quality)
        stored.spam = u256(spam)
        stored.confidence = u256(confidence)
        stored.feedback = feedback
        stored.status = status
        stored.reviewed_at = u256(now)

        if status == STATUS_APPROVED:
            self._settle_approval(campaign, stored, trust)
        elif status == STATUS_REJECTED:
            self.trust[worker] = u256(max(0, trust - 2))

        ProofVerified(u256(submission_id), worker=worker, status=status).emit()
        return submission_id

    def _settle_approval(self, campaign: Campaign, submission: Submission, trust: int) -> None:
        reward = int(campaign.reward)
        if int(campaign.spent) + reward > int(campaign.funded):
            submission.status = STATUS_REVIEW
            submission.feedback = "Campaign ran out of funds before payout"
            return
        campaign.spent = u256(int(campaign.spent) + reward)
        submission.reward_paid = u256(reward)
        worker = submission.worker
        self._credit(worker, reward, int(submission.id), f'Reward for "{campaign.title}"')
        self.approved_count[worker] = u256(
            self.balances_default(self.approved_count, worker, 0) + 1
        )
        self.trust[worker] = u256(min(100, trust + 1))
        if int(campaign.spent) + reward > int(campaign.funded):
            campaign.active = False

    # ------------------------------------------------------------- moderation

    @gl.public.write
    def moderate(self, submission_id: int, approve: bool, reason: str) -> str:
        if submission_id < 0 or submission_id >= len(self.submissions):
            raise gl.vm.UserError("Unknown submission")
        submission = self.submissions[submission_id]
        campaign = self._campaign(int(submission.campaign_id))
        self._require_owner_or_admin(campaign)
        if submission.status == STATUS_APPROVED:
            raise gl.vm.UserError("Submission already approved")

        worker = submission.worker
        trust = self._trust_of(worker)
        if approve:
            submission.status = STATUS_APPROVED
            submission.feedback = reason if reason != "" else "Approved by reviewer"
            submission.reviewed_at = u256(self._now())
            self._settle_approval(campaign, submission, trust)
        else:
            submission.status = STATUS_REJECTED
            submission.feedback = reason if reason != "" else "Rejected by reviewer"
            submission.reviewed_at = u256(self._now())
            self.trust[worker] = u256(max(0, trust - 2))
        ProofVerified(u256(int(submission.id)), worker=worker, status=submission.status).emit()
        return submission.status

    # ---------------------------------------------------------------- payouts

    @gl.public.write
    def request_payout(self, amount: int, destination: str) -> int:
        worker = gl.message.sender_address
        balance = self.balances_default(self.balances, worker, 0)
        if amount <= 0:
            raise gl.vm.UserError("Amount must be positive")
        if amount > balance:
            raise gl.vm.UserError("Amount exceeds your balance")
        if destination.strip() == "":
            raise gl.vm.UserError("Destination is required")

        payout_id = len(self.payouts)
        self.payouts.append(
            PayoutRequest(
                id=u256(payout_id),
                worker=worker,
                amount=u256(amount),
                destination=destination,
                status=PAYOUT_PENDING,
                note="",
                created_at=u256(self._now()),
            )
        )
        PayoutRequested(u256(payout_id), worker=worker, amount=u256(amount)).emit()
        return payout_id

    @gl.public.write
    def settle_payout(self, payout_id: int, approve: bool, note: str) -> str:
        if gl.message.sender_address != self.admin:
            raise gl.vm.UserError("Admin only")
        if payout_id < 0 or payout_id >= len(self.payouts):
            raise gl.vm.UserError("Unknown payout request")
        payout = self.payouts[payout_id]
        if payout.status != PAYOUT_PENDING:
            raise gl.vm.UserError("Payout already settled")

        worker = payout.worker
        amount = int(payout.amount)
        if approve:
            balance = self.balances_default(self.balances, worker, 0)
            if amount > balance:
                raise gl.vm.UserError("Worker balance no longer covers this payout")
            new_balance = balance - amount
            self.balances[worker] = u256(new_balance)
            self.ledger.append(
                LedgerEntry(
                    id=u256(len(self.ledger)),
                    worker=worker,
                    kind="payout",
                    amount=u256(amount),
                    balance_after=u256(new_balance),
                    submission_id=u256(0),
                    note=note if note != "" else "Payout settled",
                    created_at=u256(self._now()),
                )
            )
            payout.status = PAYOUT_PAID
        else:
            payout.status = PAYOUT_REJECTED
        payout.note = note
        return payout.status

    # ------------------------------------------------------------------ views

    def _campaign_dict(self, c: Campaign) -> dict:
        return {
            "id": int(c.id),
            "owner": c.owner.as_hex,
            "title": c.title,
            "description": c.description,
            "instructions": c.instructions,
            "proof_type": c.proof_type,
            "category": c.category,
            "cover_image_path": c.cover_image_path,
            "reward": str(int(c.reward)),
            "budget": str(int(c.budget)),
            "funded": str(int(c.funded)),
            "spent": str(int(c.spent)),
            "max_per_user": int(c.max_per_user),
            "cooldown_seconds": int(c.cooldown_seconds),
            "min_trust": int(c.min_trust),
            "min_text_length": int(c.min_text_length),
            "required_keywords": c.required_keywords,
            "active": c.active,
            "created_at": int(c.created_at),
        }

    def _submission_dict(self, s: Submission) -> dict:
        return {
            "id": int(s.id),
            "campaign_id": int(s.campaign_id),
            "worker": s.worker.as_hex,
            "proof_url": s.proof_url,
            "proof_text": s.proof_text,
            "image_path": s.image_path,
            "content_hash": s.content_hash,
            "status": s.status,
            "relevance": int(s.relevance),
            "quality": int(s.quality),
            "spam": int(s.spam),
            "confidence": int(s.confidence),
            "feedback": s.feedback,
            "reward_paid": str(int(s.reward_paid)),
            "created_at": int(s.created_at),
            "reviewed_at": int(s.reviewed_at),
        }

    @gl.public.view
    def get_campaigns(self) -> list:
        return [self._campaign_dict(c) for c in self.campaigns]

    @gl.public.view
    def get_campaign(self, campaign_id: int) -> dict:
        return self._campaign_dict(self._campaign(campaign_id))

    @gl.public.view
    def get_brand_campaigns(self, owner: str) -> list:
        target = Address(owner)
        return [self._campaign_dict(c) for c in self.campaigns if c.owner == target]

    @gl.public.view
    def get_campaign_submissions(self, campaign_id: int) -> list:
        return [
            self._submission_dict(s)
            for s in self.submissions
            if int(s.campaign_id) == campaign_id
        ]

    @gl.public.view
    def get_worker_submissions(self, worker: str) -> list:
        target = Address(worker)
        return [self._submission_dict(s) for s in self.submissions if s.worker == target]

    @gl.public.view
    def get_brand_submissions(self, owner: str) -> list:
        target = Address(owner)
        owned = [int(c.id) for c in self.campaigns if c.owner == target]
        return [
            self._submission_dict(s) for s in self.submissions if int(s.campaign_id) in owned
        ]

    @gl.public.view
    def get_worker(self, worker: str) -> dict:
        target = Address(worker)
        return {
            "address": target.as_hex,
            "balance": str(self.balances_default(self.balances, target, 0)),
            "total_earned": str(self.balances_default(self.total_earned, target, 0)),
            "trust": self.balances_default(self.trust, target, DEFAULT_TRUST),
            "approved": self.balances_default(self.approved_count, target, 0),
            "submissions": self.balances_default(self.submission_count, target, 0),
        }

    @gl.public.view
    def get_ledger(self, worker: str) -> list:
        target = Address(worker)
        return [
            {
                "id": int(e.id),
                "kind": e.kind,
                "amount": str(int(e.amount)),
                "balance_after": str(int(e.balance_after)),
                "submission_id": int(e.submission_id),
                "note": e.note,
                "created_at": int(e.created_at),
            }
            for e in self.ledger
            if e.worker == target
        ]

    @gl.public.view
    def get_payouts(self, worker: str) -> list:
        target = Address(worker)
        items = self.payouts if worker == "" else [p for p in self.payouts if p.worker == target]
        return [
            {
                "id": int(p.id),
                "worker": p.worker.as_hex,
                "amount": str(int(p.amount)),
                "destination": p.destination,
                "status": p.status,
                "note": p.note,
                "created_at": int(p.created_at),
            }
            for p in items
        ]

    @gl.public.view
    def get_pending_payouts(self) -> list:
        return [
            {
                "id": int(p.id),
                "worker": p.worker.as_hex,
                "amount": str(int(p.amount)),
                "destination": p.destination,
                "status": p.status,
                "note": p.note,
                "created_at": int(p.created_at),
            }
            for p in self.payouts
            if p.status == PAYOUT_PENDING
        ]

    @gl.public.view
    def get_admin(self) -> str:
        return self.admin.as_hex

    @gl.public.view
    def get_stats(self) -> dict:
        approved = len([s for s in self.submissions if s.status == STATUS_APPROVED])
        rejected = len([s for s in self.submissions if s.status == STATUS_REJECTED])
        review = len([s for s in self.submissions if s.status == STATUS_REVIEW])
        paid = 0
        for c in self.campaigns:
            paid += int(c.spent)
        return {
            "campaigns": len(self.campaigns),
            "submissions": len(self.submissions),
            "approved": approved,
            "rejected": rejected,
            "review": review,
            "total_paid": str(paid),
        }
