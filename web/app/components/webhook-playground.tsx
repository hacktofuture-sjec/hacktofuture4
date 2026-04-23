"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { getApiBase } from "@/lib/api-base";

const SAMPLE_LOG = `Traceback (most recent call last):
  File "tests/test_app.py", line 4, in <module>
    import foobar
ModuleNotFoundError: No module named 'foobar'
`;

export function WebhookPlayground() {
  const base = getApiBase();
  const [repository, setRepository] = useState("demo-repo");
  const [logText, setLogText] = useState(SAMPLE_LOG);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${base}/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repository,
          log_text: logText,
        }),
      });
      const text = await res.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
      if (!res.ok) {
        throw new Error(
          typeof json === "object" && json !== null && "detail" in json
            ? String((json as { detail: unknown }).detail)
            : `HTTP ${res.status}`,
        );
      }
      return json;
    },
  });

  return (
    <section
      className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      aria-labelledby="webhook-heading"
    >
      <h2 id="webhook-heading" className="font-serif text-xl text-zinc-900 dark:text-zinc-50">
        Try the webhook
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        POSTs sample JSON to <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">/webhook</code>. No API keys in the browser — only what you already deployed on the server is used.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200" htmlFor="repo">
            Repository label
          </label>
          <input
            id="repo"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            value={repository}
            onChange={(e) => setRepository(e.target.value)}
            autoComplete="off"
          />
          <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200" htmlFor="log">
            CI log excerpt
          </label>
          <textarea
            id="log"
            className="min-h-[220px] rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            value={logText}
            onChange={(e) => setLogText(e.target.value)}
            spellCheck={false}
          />
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Sending…" : "Send to PipelineMedic"}
          </button>
          {mutation.isError ? (
            <p className="text-sm text-red-700 dark:text-red-300" role="alert">
              {mutation.error instanceof Error ? mutation.error.message : "Request failed"}
            </p>
          ) : null}
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Response</p>
          <pre
            className="mt-2 max-h-[min(420px,60vh)] overflow-auto rounded-lg border border-zinc-200 bg-zinc-950 p-3 text-xs text-emerald-100 dark:border-zinc-700"
            aria-live="polite"
          >
            {mutation.data
              ? JSON.stringify(mutation.data, null, 2)
              : "// Run a request to see JSON here"}
          </pre>
        </div>
      </div>
    </section>
  );
}
