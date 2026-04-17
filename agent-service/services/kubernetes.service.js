const k8s = require('@kubernetes/client-node');

const NAMESPACE = process.env.KUBERNETES_NAMESPACE || 'default';
const MESSAGING_DEPLOYMENT_NAME = process.env.MESSAGING_DEPLOYMENT_NAME || 'messaging-service';
const MESSAGING_POD_LABEL = process.env.MESSAGING_POD_LABEL || 'app=messaging-service';
const MAX_CONNECTIONS_ERROR = 'Too Many Connections';
const OVERLOAD_KEYWORDS = ['traffic tsunami', 'memory overflowing', 'oomkilled', 'extreme load'];
const RESTART_WINDOW_MS = Number(process.env.RESTART_WINDOW_MS) || 5 * 60 * 1000;
const EARLY_HEAL_RESTART_THRESHOLD = Number(process.env.EARLY_HEAL_RESTART_THRESHOLD) || 2;

const restartMemory = {
  firstFailureAt: null,
  lastRestartCount: 0,
  lastObservedAt: null
};

let kubeClients = null;

const loadClients = () => {
  if (kubeClients) {
    return kubeClients;
  }

  const kubeConfig = new k8s.KubeConfig();

  try {
    if (process.env.KUBERNETES_SERVICE_HOST) {
      kubeConfig.loadFromCluster();
    } else {
      kubeConfig.loadFromDefault();
    }
  } catch (error) {
    kubeConfig.loadFromDefault();
  }

  kubeClients = {
    kubeConfig,
    objectApi: k8s.KubernetesObjectApi.makeApiClient(kubeConfig),
    coreApi: kubeConfig.makeApiClient(k8s.CoreV1Api),
    appsApi: kubeConfig.makeApiClient(k8s.AppsV1Api)
  };

  return kubeClients;
};

const getRestartCount = (pod) => {
  const containerStatus = pod.status?.containerStatuses?.find((entry) => entry.name === 'messaging-service')
    || pod.status?.containerStatuses?.[0];

  return Number(containerStatus?.restartCount) || 0;
};

const getPodName = (pods = []) => {
  const sorted = [...pods].sort((left, right) => {
    const leftRestartCount = getRestartCount(left);
    const rightRestartCount = getRestartCount(right);

    if (rightRestartCount !== leftRestartCount) {
      return rightRestartCount - leftRestartCount;
    }

    const leftCreated = new Date(left.metadata?.creationTimestamp || 0).getTime();
    const rightCreated = new Date(right.metadata?.creationTimestamp || 0).getTime();
    return rightCreated - leftCreated;
  });

  return sorted[0]?.metadata?.name || null;
};

const sortPodsByRestartAndAge = (pods = []) => {
  return [...pods].sort((left, right) => {
    const leftRestartCount = getRestartCount(left);
    const rightRestartCount = getRestartCount(right);

    if (rightRestartCount !== leftRestartCount) {
      return rightRestartCount - leftRestartCount;
    }

    const leftCreated = new Date(left.metadata?.creationTimestamp || 0).getTime();
    const rightCreated = new Date(right.metadata?.creationTimestamp || 0).getTime();
    return rightCreated - leftCreated;
  });
};
const hasTooManyConnectionsLog = (logs = '') => logs.toLowerCase().includes(MAX_CONNECTIONS_ERROR.toLowerCase());

const extractLogKeywords = (logs = '') => {
  const normalizedLogs = String(logs || '').toLowerCase();
  return OVERLOAD_KEYWORDS.filter((keyword) => normalizedLogs.includes(keyword));
};

const getOOMKilledFromStatus = (pod) => {
  const statuses = pod.status?.containerStatuses || [];
  return statuses.some((entry) => {
    const terminatedReason = entry.lastState?.terminated?.reason;
    return typeof terminatedReason === 'string' && terminatedReason.toLowerCase() === 'oomkilled';
  });
};

const normalizeLogPayload = (payload) => {
  if (!payload) {
    return '';
  }

  if (typeof payload === 'string') {
    return payload;
  }

  if (typeof payload?.body === 'string') {
    return payload.body;
  }

  return String(payload);
};

const readPodLogSafe = async (coreApi, podName, namespace, containerName, previous) => {
  if (!podName) {
    return '';
  }

  try {
    const payload = await coreApi.readNamespacedPodLog({
      name: podName,
      namespace,
      container: containerName,
      previous,
      tailLines: 200,
      timestamps: false,
      follow: false
    });

    return normalizeLogPayload(payload);
  } catch {
    return '';
  }
};
const updateRestartMemory = (restartCount) => {
  const now = Date.now();

  if (restartCount <= 0) {
    restartMemory.firstFailureAt = null;
    restartMemory.lastRestartCount = 0;
    restartMemory.lastObservedAt = now;
    return {
      persistentFailure: false,
      restartAgeMs: 0,
      restartCount
    };
  }

  if (restartCount > restartMemory.lastRestartCount) {
    if (!restartMemory.firstFailureAt) {
      restartMemory.firstFailureAt = now;
    }
    restartMemory.lastRestartCount = restartCount;
    restartMemory.lastObservedAt = now;
  } else if (!restartMemory.lastObservedAt) {
    restartMemory.lastObservedAt = now;
  }

  const restartAgeMs = restartMemory.firstFailureAt ? now - restartMemory.firstFailureAt : 0;
  const persistentFailure = restartCount >= EARLY_HEAL_RESTART_THRESHOLD && restartAgeMs <= RESTART_WINDOW_MS;

  return {
    persistentFailure,
    restartAgeMs,
    restartCount
  };
};

async function inspectMessagingDeployment() {
  const { objectApi, coreApi } = loadClients();

  const podList = await objectApi.list('v1', 'Pod', NAMESPACE, undefined, undefined, undefined, undefined, MESSAGING_POD_LABEL, 100);

  const podItems = podList.items || [];
  const sortedPods = sortPodsByRestartAndAge(podItems);
  const podName = getPodName(sortedPods);

  if (!podName) {
    return {
      available: false,
      persistentFailure: false,
      restartCount: 0,
      logsContainKeyword: false,
      podName: null,
      reason: 'Messaging pod not found'
    };
  }

  const selectedPod = sortedPods.find((pod) => pod.metadata?.name === podName) || sortedPods[0];
  const restartCount = getRestartCount(selectedPod);
  const restartAnalysis = updateRestartMemory(restartCount);
  const containerName = selectedPod.status?.containerStatuses?.[0]?.name || 'messaging-service';
  const oomKilledFromStatus = getOOMKilledFromStatus(selectedPod);

  const logBlobs = [];
  const candidatePods = sortedPods.slice(0, 3);

  for (const pod of candidatePods) {
    const candidatePodName = pod.metadata?.name;
    const candidateContainer = pod.status?.containerStatuses?.find((entry) => entry.name === 'messaging-service')?.name
      || pod.status?.containerStatuses?.[0]?.name
      || 'messaging-service';

    const previousWithContainer = await readPodLogSafe(coreApi, candidatePodName, NAMESPACE, candidateContainer, true);
    const currentWithContainer = await readPodLogSafe(coreApi, candidatePodName, NAMESPACE, candidateContainer, false);
    const previousWithoutContainer = await readPodLogSafe(coreApi, candidatePodName, NAMESPACE, undefined, true);
    const currentWithoutContainer = await readPodLogSafe(coreApi, candidatePodName, NAMESPACE, undefined, false);

    [previousWithContainer, currentWithContainer, previousWithoutContainer, currentWithoutContainer]
      .filter(Boolean)
      .forEach((entry) => {
        logBlobs.push(`[${candidatePodName}] ${entry}`);
      });
  }

  const logs = logBlobs.join('\n');

  const logsContainKeyword = hasTooManyConnectionsLog(logs);
  const detectedKeywords = extractLogKeywords(logs);
  if (oomKilledFromStatus && !detectedKeywords.includes('oomkilled')) {
    detectedKeywords.push('oomkilled');
  }
  const resourceOverload = detectedKeywords.length > 0 && restartCount >= EARLY_HEAL_RESTART_THRESHOLD;

  let deploymentReplicas = null;
  let deploymentAvailableReplicas = null;
  try {
    const deployment = await objectApi.read({
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: MESSAGING_DEPLOYMENT_NAME,
        namespace: NAMESPACE
      }
    });
    deploymentReplicas = Number(deployment?.spec?.replicas) || 0;
    deploymentAvailableReplicas = Number(deployment?.status?.availableReplicas) || 0;
  } catch {
    deploymentReplicas = null;
    deploymentAvailableReplicas = null;
  }

  return {
    available: true,
    namespace: NAMESPACE,
    podName,
    restartCount,
    deploymentReplicas,
    deploymentAvailableReplicas,
    logsContainKeyword,
    detectedKeywords,
    resourceOverload,
    logsExcerpt: logs.split('\n').slice(-20).join('\n'),
    persistentFailure: restartAnalysis.persistentFailure,
    restartAgeMs: restartAnalysis.restartAgeMs,
    reason: logsContainKeyword
      ? 'Messaging pod logs contain Too Many Connections'
      : resourceOverload
        ? 'Messaging pod is under resource overload and repeatedly restarting'
      : restartAnalysis.persistentFailure
        ? 'Messaging pod is restarting repeatedly within a short window'
        : 'Messaging pod is currently stable'
  };
}

async function patchMessagingDeploymentMaxConnections(maxConnections) {
  const { objectApi } = loadClients();
  const desiredValue = String(maxConnections);
  const now = new Date().toISOString();

  const patch = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: MESSAGING_DEPLOYMENT_NAME,
      namespace: NAMESPACE
    },
    spec: {
      template: {
        metadata: {
          annotations: {
            'nova-chat.io/advanced-heal-at': now
          }
        },
        spec: {
          containers: [
            {
              name: 'messaging-service',
              env: [
                {
                  name: 'MAX_CONNECTIONS',
                  value: desiredValue
                }
              ]
            }
          ]
        }
      }
    }
  };

  const response = await objectApi.patch(patch, undefined, undefined, 'nova-chat-agent-service', false);

  return {
    patched: true,
    deployment: MESSAGING_DEPLOYMENT_NAME,
    namespace: NAMESPACE,
    maxConnections: desiredValue,
    rolloutAnnotatedAt: now,
    raw: response
  };
}

async function scaleMessagingDeployment(replicas) {
  const { objectApi } = loadClients();
  const desiredReplicas = Number(replicas) || 1;
  const now = new Date().toISOString();

  const currentDeployment = await objectApi.read({
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: MESSAGING_DEPLOYMENT_NAME,
      namespace: NAMESPACE
    }
  });
  const previousReplicas = Number(currentDeployment?.spec?.replicas) || 0;

  const deployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: MESSAGING_DEPLOYMENT_NAME,
      namespace: NAMESPACE
    },
    spec: {
      replicas: desiredReplicas,
      template: {
        metadata: {
          annotations: {
            'nova-chat.io/scale-heal-at': now
          }
        }
      }
    }
  };

  const response = await objectApi.patch(
    deployment,
    undefined,
    undefined,
    'nova-chat-agent-service',
    undefined,
    k8s.PatchStrategy.MergePatch
  );

  const latestDeployment = await objectApi.read({
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: MESSAGING_DEPLOYMENT_NAME,
      namespace: NAMESPACE
    }
  });
  const newReplicas = Number(latestDeployment?.spec?.replicas) || desiredReplicas;

  return {
    patched: true,
    deployment: MESSAGING_DEPLOYMENT_NAME,
    namespace: NAMESPACE,
    previousReplicas,
    replicas: desiredReplicas,
    newReplicas,
    remediationSuccess: newReplicas === desiredReplicas,
    rolloutAnnotatedAt: now,
    raw: response
  };
}

module.exports = {
  inspectMessagingDeployment,
  patchMessagingDeploymentMaxConnections,
  scaleMessagingDeployment
};