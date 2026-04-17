const groqClient = require("../utils/groqClient");

function buildFallbackDecision(rca) {
  const { rootCause, reason, rootCauseType } = rca || {};

  if (!rootCause) {
    return {
      source: "fallback",
      actionNeeded: false,
      action: "none",
      target: null,
      explanation: "No remediation required because no root cause was detected."
    };
  }

  if (rootCause === "messaging-service" && rootCauseType === "configuration") {
    return {
      source: "fallback",
      actionNeeded: true,
      action: "patch_configuration",
      target: "messaging-service",
      fix: {
        maxConnections: 10
      },
      explanation: `Chosen action 'patch_configuration' for ${rootCause} because: ${reason}`
    };
  }

  if (rootCause === "messaging-service" && rootCauseType === "resource_overload") {
    return {
      source: "fallback",
      actionNeeded: true,
      action: "SCALE_DEPLOYMENT",
      target: "messaging-service",
      replicas: 3,
      explanation: `Chosen action 'SCALE_DEPLOYMENT' for ${rootCause} because: ${reason}`,
      justification: "Scaling horizontally will distribute the load and prevent further crashes."
    };
  }

  return {
    source: "fallback",
    actionNeeded: true,
    action: "recover",
    target: rootCause,
    explanation: `Chosen action 'recover' for ${rootCause} because: ${reason}`
  };
}

function sanitizeDecision(modelDecision, rca) {
  const fallback = buildFallbackDecision(rca);

  if (!modelDecision || typeof modelDecision !== "object") {
    return fallback;
  }

  const allowedActions = ["recover", "patch_configuration", "SCALE_DEPLOYMENT", "none"];
  const allowedTargets = ["auth-service", "messaging-service", "presence-service", null];

  const action = allowedActions.includes(modelDecision.action)
    ? modelDecision.action
    : fallback.action;

  const target = allowedTargets.includes(modelDecision.target)
    ? modelDecision.target
    : fallback.target;

  const actionNeeded =
    typeof modelDecision.actionNeeded === "boolean"
      ? modelDecision.actionNeeded
      : fallback.actionNeeded;

  const explanation =
    typeof modelDecision.explanation === "string" && modelDecision.explanation.trim()
      ? modelDecision.explanation
      : fallback.explanation;

  const fix =
    modelDecision.fix && typeof modelDecision.fix === "object"
      ? modelDecision.fix
      : fallback.fix;

  if (rca?.rootCause === "messaging-service" && rca?.rootCauseType === "configuration") {
    return {
      source: "groq",
      actionNeeded: true,
      action: "patch_configuration",
      target: "messaging-service",
      explanation,
      fix: {
        maxConnections: 10,
        ...(fix || {})
      }
    };
  }

  if (rca?.rootCause === "messaging-service" && rca?.rootCauseType === "resource_overload") {
    return {
      source: "groq",
      actionNeeded: true,
      action: "SCALE_DEPLOYMENT",
      target: "messaging-service",
      explanation,
      replicas: Number(modelDecision.replicas) || 3,
      justification:
        typeof modelDecision.justification === "string" && modelDecision.justification.trim()
          ? modelDecision.justification
          : "Scaling horizontally will distribute the load and prevent further crashes."
    };
  }

  return {
    source: "groq",
    actionNeeded,
    action,
    target,
    explanation,
    fix,
    replicas: typeof modelDecision.replicas === "number" ? modelDecision.replicas : fallback.replicas,
    justification: modelDecision.justification || fallback.justification
  };
}

async function decideRemediation(rca, monitoring, kubernetesSignals = {}) {
  const fallback = buildFallbackDecision(rca);

  if (rca?.rootCauseType === "resource_overload" && rca?.rootCause === "messaging-service") {
    return {
      source: "deterministic",
      actionNeeded: true,
      action: "SCALE_DEPLOYMENT",
      target: "messaging-service",
      replicas: 3,
      explanation: "Messaging-service is repeatedly restarting with overload evidence.",
      justification: "Scaling horizontally will distribute the load and prevent further crashes."
    };
  }

  if (!process.env.GROQ_API_KEY) {
    return fallback;
  }

  try {
    const prompt = `
You are an SRE remediation decision agent for a microservices chat app.

Your job:
- read the monitoring summary
- read the root cause analysis
- choose the safest action

Rules:
- Only return valid JSON
- Allowed actions: "recover", "patch_configuration", or "none"
- Allowed actions: "recover", "patch_configuration", "SCALE_DEPLOYMENT", or "none"
- Allowed targets: "auth-service", "messaging-service", "presence-service", or null
- Prefer "recover" when a service is degraded or down
- Prefer "patch_configuration" when messaging-service is restarting repeatedly and logs show Too Many Connections
- Prefer "SCALE_DEPLOYMENT" when messaging-service shows resource overload keywords such as Traffic Tsunami, Memory overflowing, or OOMKilled
- Prefer "none" only when the system is healthy and no root cause exists
- Keep explanation short and clear

Monitoring:
${JSON.stringify(monitoring, null, 2)}

RCA:
${JSON.stringify(rca, null, 2)}

Kubernetes signals:
${JSON.stringify(kubernetesSignals, null, 2)}

Return JSON in this exact shape:
{
  "actionNeeded": true,
  "action": "SCALE_DEPLOYMENT",
  "target": "messaging-service",
  "replicas": 3,
  "justification": "Scaling horizontally will distribute the load and prevent further crashes."
}
`;

    const completion = await groqClient.chat.completions.create({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a careful SRE remediation assistant. Output only valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const content = completion.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    return sanitizeDecision(parsed, rca);
  } catch (error) {
    return {
      ...fallback,
      source: "fallback",
      groqError: error.message
    };
  }
}

module.exports = {
  decideRemediation
};