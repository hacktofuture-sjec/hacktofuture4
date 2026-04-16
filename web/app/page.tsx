import Link from "next/link";
import { HealthPanel } from "./components/health-panel";
import { WebhookPlayground } from "./components/webhook-playground";
import { getApiBase } from "@/lib/api-base";

const REPO_MAIN = "https://github.com/Aqib053/hacktofuture4-D01";
const REPO_DEMO = "https://github.com/Aqib053/pipelinemedic-demo";

export default function Home() {
  const apiBase = getApiBase();

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200/80 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <span className="font-serif text-lg tracking-tight text-zinc-900 dark:text-zinc-50">
            PipelineMedic
          </span>
          <nav className="flex flex-wrap items-center gap-4 text-sm font-medium">
            <a className="text-teal-800 hover:underline dark:text-teal-400" href="#how">
              How it works
            </a>
            <a className="text-teal-800 hover:underline dark:text-teal-400" href="#status">
              Status
            </a>
            <a className="text-teal-800 hover:underline dark:text-teal-400" href="#try">
              Try webhook
            </a>
            <Link
              className="rounded-full border border-zinc-300 px-3 py-1.5 text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
              href={REPO_MAIN}
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-16 px-4 py-14 sm:px-6">
        <section className="space-y-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-teal-800 dark:text-teal-400">
            Hackathon-ready MVP
          </p>
          <h1 className="font-serif text-4xl leading-tight tracking-tight text-zinc-950 sm:text-5xl dark:text-zinc-50">
            Turn noisy CI failures into a clear next step — before your team wakes up.
          </h1>
          <p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            PipelineMedic accepts a failed build log, runs Groq-backed or rule-based analysis, notifies Telegram, and can open a targeted GitHub PR when a safe auto-fix is realistic.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              className="inline-flex items-center justify-center rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-900/20 transition hover:bg-teal-600"
              href={apiBase}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open API ({new URL(apiBase).host})
            </a>
            <a
              className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              href={REPO_DEMO}
              target="_blank"
              rel="noopener noreferrer"
            >
              Demo consumer repo
            </a>
          </div>
        </section>

        <section id="how" className="scroll-mt-20 space-y-6">
          <h2 className="font-serif text-2xl text-zinc-950 dark:text-zinc-50">Architecture</h2>
          <ol className="grid gap-4 sm:grid-cols-2">
            {[
              {
                step: "1",
                title: "CI fails",
                body: "Your workflow posts the log (and repo id) to POST /webhook — e.g. from GitHub Actions.",
              },
              {
                step: "2",
                title: "Analyze",
                body: "Groq returns structured JSON when configured; otherwise a fast rule-based fallback classifies the failure.",
              },
              {
                step: "3",
                title: "Decide",
                body: "A policy layer chooses notify-only vs auto-fix when confidence and risk look acceptable.",
              },
              {
                step: "4",
                title: "Act",
                body: "Telegram gets a concise summary; optional GitHub token enables branch + PR for safe manifest-style fixes.",
              },
            ].map((item) => (
              <li
                key={item.step}
                className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <span className="font-mono text-xs text-teal-700 dark:text-teal-400">Step {item.step}</span>
                <h3 className="mt-1 font-serif text-lg text-zinc-900 dark:text-zinc-50">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{item.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <div id="status" className="scroll-mt-20">
          <HealthPanel />
        </div>

        <div id="try" className="scroll-mt-20">
          <WebhookPlayground />
        </div>

        <footer className="border-t border-zinc-200 pt-8 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
          <p>
            Main repo:{" "}
            <a className="text-teal-800 underline hover:no-underline dark:text-teal-400" href={REPO_MAIN}>
              Aqib053/hacktofuture4-D01
            </a>
            {" · "}
            Demo template:{" "}
            <a className="text-teal-800 underline hover:no-underline dark:text-teal-400" href={REPO_DEMO}>
              Aqib053/pipelinemedic-demo
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
