const { getSystemStatus } = require("./monitor.service");
const { analyzeRootCause } = require("./rca.service");
const { decideRemediation } = require("./decision.service");
const { executeRemediation } = require("./remediation.service");
const { inspectMessagingDeployment } = require("./kubernetes.service");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runAdvancedHeal() {
  const monitoringBefore = await getSystemStatus();
  const kubernetesBefore = await inspectMessagingDeployment();
  const rca = analyzeRootCause(monitoringBefore, kubernetesBefore);
  const decision = await decideRemediation(rca, monitoringBefore, kubernetesBefore);
  const remediation = await executeRemediation(decision);

  await sleep(Number(process.env.ADVANCED_HEAL_VERIFY_DELAY_MS) || 5000);

  const kubernetesAfter = await inspectMessagingDeployment();
  const monitoringAfter = await getSystemStatus();

  return {
    success: true,
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
  runAdvancedHeal
};