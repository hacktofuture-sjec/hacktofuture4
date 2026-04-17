const { safePost } = require("../utils/http");
const { patchMessagingDeploymentMaxConnections, scaleMessagingDeployment } = require("./kubernetes.service");

const SERVICE_URLS = {
  "auth-service": process.env.AUTH_SERVICE_URL,
  "messaging-service": process.env.MESSAGING_SERVICE_URL,
  "presence-service": process.env.PRESENCE_SERVICE_URL
};

async function executeRemediation(decision) {
  const { actionNeeded, action, target } = decision || {};

  if (!actionNeeded || !target || action === "none") {
    return {
      success: false,
      executed: false,
      target: null,
      action: "none",
      message: "No remediation action was required."
    };
  }

  if (action !== "recover") {
    if (action === "patch_configuration" && target === "messaging-service") {
      const desiredMaxConnections = Number(decision?.fix?.maxConnections) || 10;

      try {
        const patchResult = await patchMessagingDeploymentMaxConnections(desiredMaxConnections);

        return {
          success: true,
          executed: true,
          target,
          action,
          message: `Patched ${target} MAX_CONNECTIONS to ${desiredMaxConnections}.`,
          raw: patchResult
        };
      } catch (error) {
        return {
          success: false,
          executed: false,
          target,
          action,
          message: `Failed to patch configuration for ${target}.`,
          error: error.message
        };
      }
    }

    if (action === "SCALE_DEPLOYMENT" && target === "messaging-service") {
      const desiredReplicas = Number(decision?.replicas) || 3;

      try {
        const patchResult = await scaleMessagingDeployment(desiredReplicas);

        return {
          success: true,
          executed: true,
          target,
          action,
          previousReplicas: patchResult.previousReplicas,
          newReplicas: patchResult.newReplicas,
          remediationSuccess: Boolean(patchResult.remediationSuccess),
          message: `Scaled ${target} from ${patchResult.previousReplicas} to ${patchResult.newReplicas} replicas.`,
          raw: patchResult
        };
      } catch (error) {
        return {
          success: false,
          executed: false,
          target,
          action,
          message: `Failed to scale deployment for ${target}.`,
          error: error.message
        };
      }
    }

    return {
      success: false,
      executed: false,
      target,
      action,
      message: `Unsupported action '${action}' in current prototype.`
    };
  }

  const targetUrl = SERVICE_URLS[target];

  if (!targetUrl) {
    return {
      success: false,
      executed: false,
      target,
      action,
      message: `No service URL configured for target '${target}'.`
    };
  }

  const response = await safePost(`${targetUrl}/simulate/recover`);

  if (!response.ok) {
    return {
      success: false,
      executed: false,
      target,
      action,
      message: `Failed to recover ${target}.`,
      error: response.error,
      raw: response.data
    };
  }

  return {
    success: true,
    executed: true,
    target,
    action,
    message: `${target} recovered successfully.`,
    raw: response.data
  };
}

module.exports = {
  executeRemediation
};