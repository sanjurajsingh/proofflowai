import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Hexagon,
  Coins,
  ScanEye,
  Users,
  Wallet,
  Scale,
  FileCheck2,
  Network,
  Droplets,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { getStats, fromWei, qk } from "@/lib/genlayer/proofflow";
import { NETWORK_LABEL, PROOFFLOW_CONTRACT_ADDRESS, FAUCET_URL } from "@/lib/genlayer/config";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ProofFlow — AI-verified proof-of-work rewards on GenLayer" },
      {
        name: "description",
        content:
          "Brands fund reward campaigns onchain, workers submit proof, and GenLayer's Intelligent Contract verifies each submission with LLM consensus before paying GEN.",
      },
      { property: "og:title", content: "ProofFlow — AI-verified proof-of-work on GenLayer" },
      {
        property: "og:description",
        content:
          "Onchain reward campaigns verified by GenLayer's Equivalence Principle. No oracles, no servers, no manual review queues.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const short = (a: string) => `${a.slice(0, 10)}…${a.slice(-6)}`;

function Landing() {
  const { data: stats } = useQuery({ queryKey: qk.stats, queryFn: getStats, retry: 1 });

  const liveStats = [
    { label: "Campaigns onchain", value: stats ? String(stats.campaigns) : "—" },
    { label: "Proofs submitted", value: stats ? String(stats.submissions) : "—" },
    { label: "Verified & approved", value: stats ? String(stats.approved) : "—" },
    {
      label: "GEN paid to workers",
      value: stats ? `${fromWei(stats.total_paid).toFixed(2)}` : "—",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 pt-20 pb-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary"
            >
              <Hexagon className="h-3.5 w-3.5" />
              Live on {NETWORK_LABEL}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="mt-6 max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl"
            >
              Reward real work.
              <br />
              <span className="text-gradient">Verified by the contract itself.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mt-6 max-w-xl text-lg text-muted-foreground"
            >
              Brands create campaigns and fund them in GEN. Workers complete tasks and submit proof.
              A GenLayer Intelligent Contract runs the AI verification itself — inside consensus —
              and credits approved workers automatically. No moderation backend, no oracles, no
              server-held keys.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <Link to="/campaigns/new">
                <Button variant="hero" size="xl">
                  Create campaign <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/marketplace">
                <Button variant="outline" size="xl">
                  Explore campaigns
                </Button>
              </Link>
            </motion.div>

            <div className="mt-8 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Network className="h-3.5 w-3.5 text-primary" />
                Contract <span className="font-mono">{short(PROOFFLOW_CONTRACT_ADDRESS)}</span>
              </span>
              <a
                href={FAUCET_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                <Droplets className="h-3.5 w-3.5" /> Get testnet GEN
              </a>
            </div>
          </div>

          {/* Live contract state card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="glass rounded-3xl border-primary/30 p-7 shadow-glow"
          >
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
              <span>Live contract state</span>
              <span className="inline-flex items-center gap-1.5 text-primary">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                onchain
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4">
              {liveStats.map((s) => (
                <div key={s.label} className="rounded-2xl border border-border/60 bg-card/40 p-4">
                  <div className="font-display text-3xl font-bold text-gradient">{s.value}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs text-muted-foreground">
              Read directly from <code className="font-mono">get_stats()</code> on the deployed
              Intelligent Contract. A dash means the value is not yet available from chain state.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Workflow */}
      <section className="border-t border-border/50">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="max-w-2xl">
            <h2 className="text-4xl font-bold md:text-5xl">The campaign and reward workflow</h2>
            <p className="mt-4 text-muted-foreground">
              Four onchain steps. Every one is a method on the same Intelligent Contract, signed by
              your own wallet.
            </p>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                n: "01",
                icon: Coins,
                t: "Brand funds a campaign",
                d: "create_campaign() stores the task, proof rules and reward. fund_campaign() escrows GEN in the contract.",
              },
              {
                n: "02",
                icon: Users,
                t: "Worker submits proof",
                d: "submit_proof() records a link, text or screenshot reference plus a content hash for duplicate detection.",
              },
              {
                n: "03",
                icon: ScanEye,
                t: "Contract verifies it",
                d: "Deterministic gates run first, then LLM verification executes inside consensus and returns a verdict.",
              },
              {
                n: "04",
                icon: Wallet,
                t: "Worker earns GEN",
                d: "Approved proofs credit the worker balance from campaign escrow. claim_reward() withdraws to their wallet.",
              },
            ].map((s) => (
              <div
                key={s.n}
                className="glass rounded-2xl p-6 transition-all hover:border-primary/40 hover:shadow-glow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
                    <s.icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <span className="font-display text-3xl font-bold text-primary/20">{s.n}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Equivalence Principle */}
      <section className="border-t border-border/50 bg-card/30">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-24 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Scale className="h-3.5 w-3.5" /> GenLayer Equivalence Principle
            </div>
            <h2 className="mt-5 text-4xl font-bold md:text-5xl">
              AI verification that reaches consensus
            </h2>
            <p className="mt-5 text-muted-foreground">
              A single model output cannot be trusted onchain — two validators asking the same
              question get slightly different answers. GenLayer solves this with the Equivalence
              Principle: each validator runs the verification prompt, and a comparative principle
              decides whether their outputs agree closely enough to be treated as the same result.
            </p>
            <ul className="mt-7 space-y-4">
              {[
                {
                  t: "Leader proposes a verdict",
                  d: "The leader validator reads the proof and returns structured scores: relevance, quality, spam risk and confidence.",
                },
                {
                  t: "Validators check equivalence",
                  d: "Our principle accepts numeric drift of up to ±15 points but requires the approve / reject / review recommendation to match.",
                },
                {
                  t: "Consensus writes state",
                  d: "Only the agreed verdict is committed. Rewards, trust scores and the worker ledger all move in the same transaction.",
                },
              ].map((i) => (
                <li key={i.t} className="flex gap-3">
                  <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <div className="font-semibold">{i.t}</div>
                    <p className="text-sm text-muted-foreground">{i.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass rounded-3xl p-6 font-mono text-xs leading-relaxed text-muted-foreground md:p-8">
            <div className="mb-4 flex items-center gap-2 text-primary">
              <Hexagon className="h-4 w-4" /> contracts/proofflow.py
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap">{`verdict = gl.eq_principle.prompt_comparative(
    judge,
    principle=(
        "Numeric scores may differ by at most 15 "
        "points and the recommendation "
        "(approve / reject / review) must match."
    ),
)`}</pre>
            <p className="mt-5 font-sans text-xs text-muted-foreground">
              Verification runs inside the contract. There is no Anthropic key, no API route and no
              server that can approve a submission on its own.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-12 text-center shadow-glow md:p-16">
          <div className="absolute inset-0 grid-bg opacity-20" />
          <div className="relative">
            <h2 className="text-4xl font-bold text-primary-foreground md:text-5xl">
              Pay only for proof that survives consensus.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
              Launch a campaign in a few minutes, or start earning GEN on an open one.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/campaigns/new">
                <Button size="xl" variant="secondary">
                  Create campaign
                </Button>
              </Link>
              <Link to="/marketplace">
                <Button size="xl" variant="outline">
                  Explore campaigns
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/50 px-6 py-8 text-center text-sm text-muted-foreground">
        ProofFlow — proof of work, verified onchain by GenLayer.
      </footer>
    </div>
  );
}
