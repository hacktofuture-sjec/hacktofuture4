const { runMLPipeline } = require('./python-ml.service');

/**
 * Build telemetry window for ML inference
 * Converts monitoring and kubernetes signals into feature vectors
 */
function buildTelemetryWindow(monitoring = {}, kubernetesSignals = {}) {
  const services = Array.isArray(monitoring?.services) ? monitoring.services : [];
  const restartCount = Number(kubernetesSignals?.restartCount) || 0;
  const deploymentReplicas = Number(kubernetesSignals?.deploymentReplicas || 1);
  const availableReplicas = Number(kubernetesSignals?.deploymentAvailableReplicas || deploymentReplicas);
  const resourceOverload = Boolean(kubernetesSignals?.resourceOverload);

  // Build aggregated telemetry snapshot from all services
  // The ML model expects per-service telemetry or aggregated system metrics
  
  const aggregated = {
    cpu_percent: 30,      // Default nominal
    memory_mb: 400,       // Default nominal
    latency_ms: 100,      // Default nominal
    restart_count: restartCount,
    error_count: 0,
    requests_per_sec: 200,
    active_connections: 50,
    replicas: availableReplicas,
    available_replicas: availableReplicas,
    is_reachable: 1,
  };

  // Sum up metrics across services
  let totalCpu = 0;
  let totalMemory = 0;
  let totalLatency = 0;
  let totalErrors = 0;
  let healthyCount = 0;
  let degradedCount = 0;

  for (const service of services) {
    const health = (service?.health || 'healthy').toLowerCase();
    const mode = (service?.mode || '').toLowerCase();

    // Infer CPU usage from health/mode
    if (health === 'critical' || health === 'down') {
      totalCpu += 85;
      totalErrors += 50;
    } else if (health === 'degraded') {
      totalCpu += 65;
      totalErrors += 20;
      degradedCount++;
    } else {
      totalCpu += 25;
      healthyCount++;
    }

    // Infer memory from mode
    if (mode.includes('overload')) {
      totalMemory += 1400;
    } else if (mode.includes('crash') || mode.includes('error')) {
      totalMemory += 800;
    } else {
      totalMemory += 350;
    }

    // Infer latency from health/mode
    if (mode.includes('latency')) {
      totalLatency += 1200;
    } else if (health === 'critical') {
      totalLatency += 3000;
    } else if (health === 'degraded') {
      totalLatency += 800;
    } else {
      totalLatency += 100;
    }
  }

  const serviceCount = Math.max(services.length, 1);
  aggregated.cpu_percent = Math.min(99, totalCpu / serviceCount);
  aggregated.memory_mb = totalMemory / serviceCount;
  aggregated.latency_ms = totalLatency / serviceCount;
  aggregated.error_count = Math.round(totalErrors / serviceCount);
  aggregated.requests_per_sec = resourceOverload ? 1500 : 200;
  aggregated.active_connections = resourceOverload ? 800 : 50;
  aggregated.is_reachable = healthyCount > degradedCount ? 1 : (healthyCount > 0 ? 1 : 0);

  // Return as single-element window (can extend to multi-element for trends)
  return [aggregated];
}

/**
 * Transform ML pipeline output into dashboard-friendly insight format
 */
function transformMLResult(pipelineResult = {}) {
  if (!pipelineResult || !pipelineResult.success) {
    return null;
  }

  const insights = pipelineResult.ml_insights || {};
  const safetyStages = pipelineResult.stages?.safety || {};
  const rcaStages = pipelineResult.stages?.rca || {};
  const executionMode = insights.execution_mode || (insights.is_safe_to_execute ? 'AUTO' : 'REVIEW');
  const confidence = Number(insights.confidence) || 0;

  return {
    anomaly: Boolean(insights.anomaly_detected),
    suspectedService: pipelineResult.service || null,
    confidence,
    confidenceScore: confidence,
    severity: insights.predicted_severity || 'low',
    reason: insights.recommended_reason || rcaStages.reason || 'No specific insight',
    reasoning: rcaStages.reason || insights.recommended_reason || '',
    explanation: insights.recommended_reason || rcaStages.reason || 'No specific insight',
    executionMode,
    
    // Expanded ML insights
    predictedIncidentType: insights.predicted_incident_type,
    anomalyScore: Number(insights.anomaly_score) || 0,
    confidenceLevel: insights.confidence_level || executionMode.toLowerCase(),
    recommendedAction: insights.recommended_action,
    isSafeToExecute: Boolean(insights.is_safe_to_execute),
    contributingSignals: Array.isArray(insights.contributing_signals) ? insights.contributing_signals : [],
    contributingFactors: Array.isArray(insights.contributing_factors) ? insights.contributing_factors : [],
    classProbs: insights.class_probabilities || {},

    // For backward compatibility
    scores: []
  };
}

async function getMlInsight(monitoring = {}, kubernetesSignals = {}, telemetryWindowOverride = null) {
  try {
    // Build telemetry window from current monitoring state unless an explicit one was provided.
    const telemetryWindow = Array.isArray(telemetryWindowOverride) && telemetryWindowOverride.length > 0
      ? telemetryWindowOverride
      : buildTelemetryWindow(monitoring, kubernetesSignals);

    if (!telemetryWindow || telemetryWindow.length === 0) {
      return null;
    }

    // Run ML pipeline
    const pipelineResult = await runMLPipeline(
      telemetryWindow,
      'messaging-service' // Primary service being monitored
    );

    if (!pipelineResult) {
      return null;
    }

    // Transform result into insight format
    const insight = transformMLResult(pipelineResult);
    return insight;

  } catch (err) {
    console.error('[ML Insight Error]', err.message);
    return null;
  }
}

module.exports = {
  getMlInsight,
  buildTelemetryWindow,
  transformMLResult
};
