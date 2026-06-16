# Slack Setup For PipelineIQ Auto-fix Notifications

Use this guide to enable Slack notifications for medium-risk approval flows and low-risk auto-merge flows.

## 1. Create or choose a Slack channel

Create a channel like `#devops-alerts` and decide who should receive notifications.

Recommended:

- one shared channel for all auto-fix events
- one on-call mention, e.g. `@devops-oncall`

## 2. Create an Incoming Webhook app in Slack

1. Go to Slack API: https://api.slack.com/apps
2. Click `Create New App`
3. Choose `From scratch`
4. Open `Incoming Webhooks`
5. Enable Incoming Webhooks
6. Click `Add New Webhook to Workspace`
7. Select your target channel
8. Copy the webhook URL

## 3. Configure environment variables

Update your root `.env` with:
    
```env
SLACK_ENABLED=true
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/REPLACE/THIS/VALUE
SLACK_DEFAULT_CHANNEL=#devops-alerts
SLACK_DEVOPS_MENTION_DEFAULT=@devops-oncall
```

Notes:

- `SLACK_WEBHOOK_URL` is required to send messages.
- `SLACK_DEVOPS_MENTION_DEFAULT` is optional but recommended.
- You can also set workspace-specific engineer mention from the UI prompt when running auto-fix.

## 4. Restart services

After changing `.env`, restart backend so settings reload.

## 5. What messages are sent

PipelineIQ sends Slack messages for:

- medium risk (`auto_fix_below < score <= require_approval_above`):
  - PR is opened automatically
  - signed approval URL is included
  - message includes error brief, error file, fix brief, PR link
- low risk (`score <= auto_fix_below`):
  - PR is auto-merged
  - message includes error brief, error file, fix brief, PR link
  - signed URL is not included
- approval decisions:
  - approve merges PR
  - reject closes PR without merge
  - decision update is sent to Slack

## 6. Quick test

1. Trigger a failure and diagnosis.
2. Ensure score falls in medium range.
3. Confirm a PR opens automatically.
4. Confirm Slack message includes:
   - error brief
   - fix brief
   - signed URL
   - PR link
5. Approve from signed URL and confirm PR is merged.
6. Repeat and reject; confirm PR is closed without merge.
