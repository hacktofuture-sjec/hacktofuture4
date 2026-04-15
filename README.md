# PipelineMedic (Hackathon MVP)

**Push → CI fails → POST log to this API → Groq explains the failure → Telegram alerts your team.**

## What ships in the MVP

| Layer | What |
|--------|------|
| **Core** | `POST /webhook` with `repository` + `log` (or `log_text`) → JSON with diagnosis + suggested fix |
| **LLM** | Groq when `GROQ_API_KEY` is set; otherwise fast **rule-based** fallback (good for offline demos) |
| **Alerts** | Structured message to **Telegram** (plus console); set `TELEGRAM_*` |
| **Autofix PR** | On **auto_fix** (fixable + confidence > 0.7): commits a patch and opens a **PR** when `GITHUB_TOKEN` is set; **Telegram** includes the PR link after the PR step |
| **Extra** | JSON memory under `data/` (optional for demos) |

## Quick run (judges / local)

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill GROQ + Telegram at minimum
python main.py         # http://127.0.0.1:8000
```

In another terminal:

```bash
chmod +x demo.sh && ./demo.sh
```

Open `GET http://127.0.0.1:8000/` — should return `{"status":"ok",...}`.

## Deploy (public webhook)

Use **Vercel**: set the same env vars in the project dashboard, deploy this repo, then call `https://<project>.vercel.app/webhook` from GitHub Actions (store URL in `PIPELINEMEDIC_WEBHOOK_URL`).

## Full judge demo (push → fail → rectify → Telegram → PR)

Use the sample app in **`examples/demo-repo/`**: copy it into a **separate** GitHub repo, add the webhook secret, push. See that folder’s `README.md`. For **PR creation**, add `GITHUB_TOKEN` on Vercel with access to that demo repo.

## Environment variables

See `.env.example`. **LLM + alerts:** `GROQ_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. **Real PRs:** add `GITHUB_TOKEN` (classic PAT or fine-grained with Contents + PRs on the target repo) and ensure `repository` is `owner/repo` (or set `GITHUB_DEFAULT_OWNER` + short name).

## Out of scope (MVP)

Auto-merge, Slack/Teams, multi-tenant DB, guaranteed correct fixes for every error type.
