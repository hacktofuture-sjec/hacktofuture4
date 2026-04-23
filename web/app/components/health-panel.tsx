import { getApiBase } from "@/lib/api-base";

export type HealthPayload = {
  status: string;
  service: string;
  version: string;
  groq_configured: boolean;
  telegram_configured: boolean;
  github_token_configured: boolean;
  langfuse_configured?: boolean;
};

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white/60 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/40">
      <span className="text-sm text-zinc-600 dark:text-zinc-400">{label}</span>
      <span
        className={`text-xs font-semibold uppercase tracking-wide ${
          ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
        }`}
      >
        {ok ? "Ready" : "Not set"}
      </span>
    </div>
  );
}

export async function HealthPanel() {
  const base = getApiBase();
  let data: HealthPayload | null = null;
  let error: string | null = null;

  try {
    const res = await fetch(`${base}/`, { next: { revalidate: 30 } });
    if (!res.ok) {
      error = `HTTP ${res.status}`;
    } else {
      data = (await res.json()) as HealthPayload;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Request failed";
  }

  return (
    <section
      className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900"
      aria-labelledby="health-heading"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="health-heading" className="font-serif text-xl text-zinc-900 dark:text-zinc-50">
            Live API status
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Server-rendered check of <code className="rounded bg-zinc-200/80 px-1 py-0.5 text-xs dark:bg-zinc-800">{base}</code>
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          Could not reach the API: {error}
        </p>
      ) : data ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Flag ok={data.groq_configured} label="Groq" />
          <Flag ok={data.telegram_configured} label="Telegram" />
          <Flag ok={data.github_token_configured} label="GitHub token" />
          <Flag ok={Boolean(data.langfuse_configured)} label="Langfuse" />
        </div>
      ) : null}
    </section>
  );
}
