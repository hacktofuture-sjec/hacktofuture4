# PipelineMedic demo app

This mini repo is meant to be **copied into its own GitHub repository** (not necessarily the PipelineMedic service repo).

## What happens

1. `app.py` imports `requests`, but `requirements.txt` does not list it → **CI fails** with `ModuleNotFoundError`.
2. The workflow POSTs the **real log** to your **PipelineMedic** `/webhook`.
3. PipelineMedic analyzes (Groq), may open a **PR** adding `requests` if `GITHUB_TOKEN` is set on the server, and sends **Telegram**.

## Setup

1. Create a new GitHub repo (e.g. `yourname/pipelinemedic-demo`).
2. Copy **these files** into it (same paths), commit, push.
3. In that repo: **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `PIPELINEMEDIC_WEBHOOK_URL`
   - Value: `https://<your-vercel-app>.vercel.app/webhook`
4. On **Vercel** (PipelineMedic project): set `GITHUB_TOKEN` to a PAT that can push branches + open PRs **on this demo repo** (and redeploy).

## After the first PR merges

Add `requests` to `requirements.txt` (or merge PipelineMedic’s PR). The next push should go **green**.
