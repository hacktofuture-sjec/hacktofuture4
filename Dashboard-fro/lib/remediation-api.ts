'use client';

import { AgentAnalyzeResponse, fetchAgentAnalyze } from '@/lib/agent-analyze';

type HealResponse = {
  success?: boolean;
  message?: string;
  remediation?: {
    success?: boolean;
    message?: string;
    action?: string;
    target?: string;
  };
  required_action?: string;
  root_cause_analysis?: string;
  incident_status?: string;
  remediation_success?: boolean;
  new_replicas?: number;
  previous_replicas?: number;
};

const normalizeBaseUrl = (value?: string) => (value || '').replace(/\/+$/, '');

const getAgentBaseUrl = () => {
  const envBase = normalizeBaseUrl(process.env.NEXT_PUBLIC_AGENT_BASE_URL);
  if (envBase) return envBase;

  const legacyEnvBase = normalizeBaseUrl(process.env.NEXT_PUBLIC_AGENT_URL);
  if (legacyEnvBase) return legacyEnvBase;

  return 'http://127.0.0.1:4000';
};

async function postAgentEndpoint(path: '/agent/heal' | '/agent/scale-heal'): Promise<HealResponse> {
  const baseUrl = getAgentBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`${path} failed with status ${response.status}`);
  }

  return (await response.json()) as HealResponse;
}

export async function fetchRemediationAnalyze(): Promise<AgentAnalyzeResponse> {
  return fetchAgentAnalyze();
}

export async function executeHeal() {
  return postAgentEndpoint('/agent/heal');
}

export async function executeScaleHeal() {
  return postAgentEndpoint('/agent/scale-heal');
}