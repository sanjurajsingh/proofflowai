import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Zap, ShieldCheck, Coins, ArrowRight, CheckCircle2, Droplets, Hexagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Live testnet banner */}
      <div className="relative z-50 w-full border-b border-primary/30 bg-gradient-to-r from-primary/15 via-primary/5 to-primary/15">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2 px-6 py-2 text-xs font-medium">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="text-foreground/80">Live on</span>
          <span className="font-semibold text-primary">GenLayer Testnet</span>
          <span className="hidden text-muted-foreground sm:inline">. AI verified proof of work protocol</span>
          <a
            href="https://testnet-faucet.genlayer.foundation/"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 inline-flex items-center gap-1 rounded-full border border-primary/40 bg-background px-2.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/10"
          >
            <Droplets className="h-3 w-3" /> Faucet
          </a>
        </div>
      </div>

      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="relative mx-auto max-w-7xl px-6 pt-24 pb-32 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary"
          >
            <Hexagon className="h-3.5 w-3.5" />
            AI verified proof of work, powered by GenLayer
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="mx-auto max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl"
          >
            Onchain rewards.<br />
            <span className="text-gradient">AI verified proof.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl"
          >
            Brands fund campaign treasuries onchain. Workers submit proof, AI validates,
            and smart contract escrow settles rewards. All on the GenLayer testnet.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-3"
          >
            <ConnectWalletButton />
            <Link to="/marketplace"><Button variant="outline" size="xl">Browse tasks</Button></Link>
          </motion.div>

          {/* Stat row */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mx-auto mt-20 grid max-w-3xl grid-cols-3 gap-6"
          >
            {[
              { v: "98.4%", l: "Spam caught" },
              { v: "<3s", l: "Avg validation" },
              { v: "$0", l: "Per rejection" },
            ].map((s) => (
              <div key={s.l} className="glass rounded-2xl p-6">
                <div className="text-3xl font-bold text-gradient">{s.v}</div>
                <div className="mt-1 text-xs text-muted-foreground">{s.l}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-16 text-center">
          <h2 className="text-4xl font-bold md:text-5xl">Built for verified outcomes</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Every submission is scored across four dimensions before a single token leaves your treasury.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: Zap, title: "Instant AI scoring", desc: "Relevance, quality, spam risk and completion confidence on every submission." },
            { icon: ShieldCheck, title: "Fraud proof proof", desc: "Image, link, and text analysis catches recycled content and AI generated junk." },
            { icon: Coins, title: "Pay per verified", desc: "Budget never moves until the AI or your team approves. Auto refund on rejection." },
          ].map((f) => (
            <div key={f.title} className="group glass rounded-2xl p-6 transition-all hover:border-primary/40 hover:shadow-glow">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
                <f.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border/50 bg-card/30">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <h2 className="mb-16 text-center text-4xl font-bold md:text-5xl">How it works</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { n: "01", t: "Brand creates campaign", d: "Set the task, proof requirements, reward, and total budget." },
              { n: "02", t: "Users submit proof", d: "Workers complete the task and upload screenshots, links, or text." },
              { n: "03", t: "AI validates and pays", d: "Submissions are scored, approved automatically, and rewards settle onchain." },
            ].map((s) => (
              <div key={s.n} className="relative">
                <div className="font-display text-6xl font-bold text-primary/20">{s.n}</div>
                <h3 className="mt-2 text-xl font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-12 text-center shadow-glow md:p-16">
          <div className="absolute inset-0 grid-bg opacity-20" />
          <div className="relative">
            <h2 className="text-4xl font-bold text-primary-foreground md:text-5xl">
              Stop paying for noise.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
              Connect a wallet and launch your first AI validated campaign in under 60 seconds.
            </p>
            <div className="mt-8 flex justify-center">
              <ConnectWalletButton />
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-primary-foreground/70">
              {["No email required", "Free AI validation", "Pay only verified"].map((t) => (
                <span key={t} className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />{t}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/50 px-6 py-8 text-center text-sm text-muted-foreground">
        ProofFlow.AI . proof of work, verified.
      </footer>
    </div>
  );
}
