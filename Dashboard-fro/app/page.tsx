'use client'

import { Hero } from '@/components/ui/hero'
import { TopNavGlass } from '@/components/home/TopNavGlass'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'
import { Footer } from '@/components/ui/footer-section'

export default function HomePage() {
  const { isAuthenticated } = useAuth()
  const scene = process.env.NEXT_PUBLIC_SPLINE_SCENE_URL || ''
  const topPrompt =
    'React component successfully integrated with shadcn/ui structure, Tailwind CSS, and TypeScript support.'

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#030712] text-white">
      <TopNavGlass />
      
      <Hero />

      <section className="relative border-b border-white/10 bg-[#05080f] pt-20">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <p className="text-sm text-white/75">{topPrompt}</p>
        </div>
      </section>

      <section
        id="capabilities"
        className="relative border-t border-white/5 bg-[#030712] py-24"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_500px_at_50%_0%,rgba(14,165,233,0.10),transparent_60%)]" />
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-2xl">
            <div className="text-xs tracking-wide text-white/55">Capabilities</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
              Autonomous recovery, engineered for reality.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-white/60 sm:text-lg">
              A self-healing control plane that detects, diagnoses, and remediates issues across distributed systems — with a calm, cinematic representation of state.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                title: 'Anomaly detection',
                body: 'Signals unify across traces, logs, and metrics to surface drift early and confidently.',
              },
              {
                title: 'Causal graph expansion',
                body: 'Services separate into dependency-aware layers — isolate the cause, not the symptoms.',
              },
              {
                title: 'Self-healing actions',
                body: 'Safe, constrained remediations with rollback semantics and real-time verification.',
              },
            ].map((c) => (
              <div
                key={c.title}
                className="glass-lg rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <div className="mb-3 h-1 w-10 rounded-full bg-gradient-to-r from-[#0EA5E9] to-[#1D4ED8]" />
                <h3 className="text-lg font-semibold text-white">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="security" className="border-t border-white/5 bg-[#030712] py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <div className="text-xs tracking-wide text-white/55">Security</div>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
                Enterprise-grade by design.
              </h2>
              <p className="mt-5 text-base leading-relaxed text-white/60 sm:text-lg">
                Built for regulated environments. Tight controls, auditable actions, and minimal attack surface — without sacrificing motion precision or UX clarity.
              </p>
            </div>

            <div className="glass-lg rounded-2xl border border-white/10 bg-white/[0.03] p-7">
              <ul className="space-y-4 text-sm text-white/70">
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#0EA5E9] shadow-[0_0_20px_rgba(14,165,233,0.45)]" />
                  Least-privilege automations with explicit policy boundaries
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#1D4ED8] shadow-[0_0_20px_rgba(29,78,216,0.4)]" />
                  Full audit logs for every detection and remediation action
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#0EA5E9] shadow-[0_0_20px_rgba(14,165,233,0.45)]" />
                  Zero-trust ready integration for modern cloud footprints
                </li>
              </ul>
              <div className="mt-8">
                <Link
                  href={isAuthenticated ? "/security-brief" : "/auth"}
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-white/90 backdrop-blur-xl transition hover:bg-white/[0.06]"
                >
                  Download security brief →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
