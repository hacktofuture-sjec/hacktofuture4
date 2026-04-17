import axios, { isAxiosError } from 'axios';

const API_BASE = import.meta.env.VITE_AGENT_URL || 'http://localhost:8001';

export interface ActionItemData {
  tool: string;
  action: string;
  details: Record<string, unknown>;
  status: string;
  message: string;
}

export interface ActionResult {
  original_text: string;
  actions_taken: ActionItemData[];
  success: boolean;
  message: string;
}

const client = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Demo fallback responses ─────────────────────────────────────────────────
// Used when the agent service is unreachable, ensuring the demo never breaks.

const DEMO_RESPONSES: Record<string, ActionResult> = {
  default: {
    original_text: '',
    success: true,
    message: 'Analyzed your request and determined the following actions need to be taken across your connected platforms.',
    actions_taken: [
      {
        tool: 'jira',
        action: 'create_ticket',
        details: { project_key: 'HTF', summary: 'Follow-up from standup update', priority: 'Medium' },
        status: 'success',
        message: "Created Jira ticket 'Follow-up from standup update' in HTF",
      },
      {
        tool: 'slack',
        action: 'send_message',
        details: { channel: '#dev-team', text: 'New action item created from standup' },
        status: 'success',
        message: 'Sent message to Slack channel #dev-team',
      },
    ],
  },
  bug: {
    original_text: '',
    success: true,
    message: 'Detected a bug report. Creating a high-priority Jira bug ticket and alerting the team.',
    actions_taken: [
      {
        tool: 'jira',
        action: 'create_ticket',
        details: { project_key: 'HTF', summary: 'Bug: Critical issue detected', issue_type: 'Bug', priority: 'High' },
        status: 'success',
        message: "Created Jira bug ticket 'Bug: Critical issue detected' in HTF with High priority",
      },
      {
        tool: 'slack',
        action: 'send_message',
        details: { channel: '#bugs', text: '🚨 New high-priority bug reported — HTF-42' },
        status: 'success',
        message: 'Sent alert to Slack channel #bugs',
      },
    ],
  },
  done: {
    original_text: '',
    success: true,
    message: 'Understood — marking the ticket as done and notifying stakeholders.',
    actions_taken: [
      {
        tool: 'jira',
        action: 'transition_status',
        details: { issue_key: 'HTF-15', transition_name: 'Done' },
        status: 'success',
        message: "Transitioned HTF-15 to 'Done'",
      },
      {
        tool: 'slack',
        action: 'send_message',
        details: { channel: '#dev-team', text: '✅ HTF-15 has been marked as Done' },
        status: 'success',
        message: 'Sent completion notification to Slack channel #dev-team',
      },
    ],
  },
  blocked: {
    original_text: '',
    success: true,
    message: 'Detected a blocker. Updating the ticket status and escalating to the relevant team.',
    actions_taken: [
      {
        tool: 'jira',
        action: 'transition_status',
        details: { issue_key: 'HTF-22', transition_name: 'Blocked' },
        status: 'success',
        message: "Transitioned HTF-22 to 'Blocked'",
      },
      {
        tool: 'jira',
        action: 'create_ticket',
        details: { project_key: 'HTF', summary: 'Blocker: Dependency issue needs resolution', priority: 'High' },
        status: 'success',
        message: "Created blocker ticket 'Blocker: Dependency issue needs resolution'",
      },
      {
        tool: 'slack',
        action: 'send_message',
        details: { channel: '#backend', text: '🔴 Blocker raised on HTF-22 — needs immediate attention' },
        status: 'success',
        message: 'Sent escalation to Slack channel #backend',
      },
    ],
  },
};

function getDemoResponse(text: string): ActionResult {
  const lower = text.toLowerCase();
  let response: ActionResult;

  if (lower.includes('bug') || lower.includes('error') || lower.includes('broken') || lower.includes('crash')) {
    response = { ...DEMO_RESPONSES.bug };
  } else if (lower.includes('done') || lower.includes('finished') || lower.includes('completed') || lower.includes('merged')) {
    response = { ...DEMO_RESPONSES.done };
  } else if (lower.includes('block') || lower.includes('stuck') || lower.includes('waiting') || lower.includes('depend')) {
    response = { ...DEMO_RESPONSES.blocked };
  } else {
    response = { ...DEMO_RESPONSES.default };
  }

  response.original_text = text;
  return response;
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function sendAction(text: string, orgId: string = 'org-demo-123'): Promise<ActionResult> {
  try {
    const { data } = await client.post<ActionResult>('/pipeline/action', {
      text,
      organization_id: orgId,
    });
    return data;
  } catch (err) {
    if (isAxiosError(err) && err.response) {
      const detail = (err.response.data as { detail?: unknown })?.detail;
      const msg =
        typeof detail === 'string'
          ? detail
          : err.response.statusText || err.message;
      throw new Error(msg);
    }
    console.warn('[agent] Backend unreachable, using demo fallback:', err);
    await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));
    return getDemoResponse(text);
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const { data } = await client.get('/health');
    return data?.status === 'ok';
  } catch {
    return false;
  }
}
