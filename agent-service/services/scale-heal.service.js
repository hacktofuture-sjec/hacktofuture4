const { getSystemStatus } = require("./monitor.service");
const { analyzeRootCause } = require("./rca.service");
const { decideRemediation } = require("./decision.service");
const { executeRemediation } = require("./remediation.service");
const { inspectMessagingDeployment } = require("./kubernetes.service");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runScaleHeal() {
  const monitoringBefore = await getSystemStatus();
  const kubernetesBefore = await inspectMessagingDeployment();
  const rca = analyzeRootCause(monitoringBefore, kubernetesBefore);

  if (rca.rootCauseType !== 'resource_overload') {
    return {
      incident_status: 'No Action Required',
      root_cause_analysis: rca.reason,
      required_action: 'NONE',
      target_deployment: null,
      recommended_replicas: null,
      justification: 'Resource overload was not detected, so scaling was not applied.',
      monitoringBefore,
      kubernetesBefore,
      rca,
      decision: await decideRemediation(rca, monitoringBefore, kubernetesBefore),
      remediation: {
        success: false,
        executed: false,
        message: 'No scaling action was required.'
      },
      kubernetesAfter: kubernetesBefore,
      monitoringAfter: monitoringBefore
    };
  }

  const decision = await decideRemediation(rca, monitoringBefore, kubernetesBefore);
  const remediation = await executeRemediation(decision);

  await sleep(Number(process.env.SCALE_HEAL_VERIFY_DELAY_MS) || 5000);

  const kubernetesAfter = await inspectMessagingDeployment();
  const monitoringAfter = await getSystemStatus();

  return {
    incident_status: 'Acknowledged',
    root_cause_analysis: 'The service is crashing due to extreme traffic load and memory exhaustion.',
    required_action: 'SCALE_DEPLOYMENT',
    target_deployment: 'messaging-service',
    recommended_replicas: 3,
    justification: 'Scaling horizontally will distribute the load and prevent further crashes.',
    previous_replicas: remediation.previousReplicas,
    new_replicas: remediation.newReplicas,
    remediation_success: remediation.remediationSuccess,
    monitoringBefore,
    kubernetesBefore,
    rca,
    decision,
    remediation,
    kubernetesAfter,
    monitoringAfter
  };
}

module.exports = {
  runScaleHeal
};