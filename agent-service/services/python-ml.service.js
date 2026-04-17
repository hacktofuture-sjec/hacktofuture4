/**
 * python-ml.service.js
 * 
 * Bridges Node.js backend to Python ML pipeline for:
 * - Validation
 * - Feature engineering
 * - Anomaly detection
 * - Failure classification
 * - Root cause analysis
 * - Decision making
 * - Safety policy application
 */

const path = require('path');
const fs = require('fs');
const axios = require('axios');

const ML_MODEL_DIR = path.resolve(__dirname, '../../model/model/ml');

const normalizeBaseUrl = (value) => (value || '').replace(/\/+$/, '');

const getMlServiceCandidates = () => {
  const envUrl = normalizeBaseUrl(process.env.ML_SERVICE_URL);
  const publicUrl = normalizeBaseUrl(process.env.ML_SERVICE_PUBLIC_URL);

  return [
    envUrl,
    publicUrl,
    'http://ml-service:5050',
    'http://127.0.0.1:5050',
    'http://localhost:5050',
  ].filter(Boolean);
};

const buildMlPipelineEnvelope = (prediction, serviceName) => {
  const confidence = Number(prediction?.confidence_score ?? prediction?.confidence ?? 0) || 0;
  const anomalyDetected = Boolean(prediction?.anomaly_detected);
  const recommendedAction = prediction?.recommended_action || 'NONE';
  const executionMode = prediction?.execution_mode || (confidence > 0.8 ? 'AUTO' : confidence > 0.5 ? 'REVIEW' : 'BLOCKED');

  return {
    success: true,
    service: serviceName,
    stages: {
      classification: {
        predicted_class: prediction?.predicted_class || 'healthy',
        confidence,
        all_probabilities: {},
        status: 'success'
      },
      rca: {
        predicted_class: prediction?.predicted_class || 'healthy',
        severity: prediction?.severity || 'low',
        reason: prediction?.explanation || 'No specific insight',
        contributing_factors: [],
        signals: [],
        status: 'success'
      },
      decision: {
        action: recommendedAction,
        reason: prediction?.explanation || 'ML service generated a remediation recommendation',
        confidence_level: executionMode.toLowerCase(),
        auto_remediate: executionMode === 'AUTO',
        status: 'success'
      },
      safety: {
        final_action: recommendedAction,
        safe_to_execute: executionMode === 'AUTO',
        policy_overrides: [],
        status: 'success'
      }
    },
    ml_insights: {
      anomaly_detected: anomalyDetected,
      anomaly_score: anomalyDetected ? Math.max(0.5, confidence) : Math.min(confidence, 0.25),
      predicted_incident_type: prediction?.predicted_class || 'healthy',
      confidence,
      confidence_level: executionMode.toLowerCase(),
      predicted_severity: prediction?.severity || 'low',
      recommended_action: recommendedAction,
      recommended_reason: prediction?.explanation || 'No specific insight',
      is_safe_to_execute: executionMode === 'AUTO',
      contributing_signals: [],
      contributing_factors: [],
      class_probabilities: {},
    },
    telemetry_summary: {
      current: null,
      trends: {},
      window_size: 1,
    },
  };
};

/**
 * Run the Python ML pipeline on telemetry data
 * @param {Object} telemetryWindow - Array of telemetry readings (sliding window)
 * @param {string} serviceName - Target service name
 * @returns {Promise<Object>} Complete ML pipeline result
 */
async function runMLPipeline(telemetryWindow = [], serviceName = 'target-service') {
  if (!Array.isArray(telemetryWindow) || telemetryWindow.length === 0) {
    return null;
  }

  const inputData = {
    telemetry_window: telemetryWindow,
    service_name: serviceName,
    verbose: false
  };
  const latestTelemetry = telemetryWindow[telemetryWindow.length - 1] || {};
  const httpPayload = {
    ...latestTelemetry,
    service_name: serviceName,
  };

  for (const baseUrl of getMlServiceCandidates()) {
    try {
      const response = await axios.post(`${baseUrl}/predict`, httpPayload, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const prediction = response?.data || {};
      if (prediction.error) {
        continue;
      }

      return buildMlPipelineEnvelope(prediction, serviceName);
    } catch (error) {
      const status = error?.response?.status;
      if (status && status !== 404) {
        console.warn(`[ML] HTTP prediction failed from ${baseUrl}:`, error.message);
      }
    }
  }

  try {
    const { spawn } = require('child_process');
    const modelDir = path.join(ML_MODEL_DIR, 'models');
    const requiredModels = [
      'classifier.pkl',
      'label_encoder.pkl',
      'anomaly_model.pkl'
    ];

    const missingModels = requiredModels.filter(model =>
      !fs.existsSync(path.join(modelDir, model))
    );

    if (missingModels.length > 0) {
      console.warn('[ML] Missing trained models:', missingModels);
      return null;
    }

    const pythonScript = path.join(ML_MODEL_DIR, 'api_pipeline.py');
    if (!fs.existsSync(pythonScript)) {
      console.warn('[ML] Pipeline script not found at', pythonScript);
      return null;
    }

    const python = spawn('python', [pythonScript], {
      cwd: ML_MODEL_DIR,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    python.stdin.write(JSON.stringify(inputData));
    python.stdin.end();

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const code = await new Promise((resolve) => {
      python.on('close', resolve);
      python.on('error', () => resolve(-1));
    });

    if (code !== 0) {
      console.warn('[ML Pipeline] Exited with code', code);
      if (stderr) console.warn('[ML Pipeline stderr]', stderr);
      return null;
    }

    const trimmed = stdout.trim();
    if (!trimmed) {
      console.warn('[ML] Empty pipeline output');
      return null;
    }

    let result;
    const lines = trimmed.split('\n').reverse();
    for (const line of lines) {
      if (line.trim().startsWith('{')) {
        try {
          result = JSON.parse(line);
          if (result && typeof result === 'object') {
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }

    if (!result || !result.success) {
      return null;
    }

    return result;
  } catch (error) {
    console.error('[ML Pipeline Error]', error.message);
    return null;
  }
}

/**
 * Quick anomaly check without full pipeline
 * Useful for rapid anomaly scoring
 */
async function detectAnomalyQuick(telemetry = {}) {
  const pythonScript = path.join(ML_MODEL_DIR, 'pipeline', 'anomaly.py');
  
  return new Promise((resolve) => {
    if (!fs.existsSync(pythonScript)) {
      return resolve(null);
    }

    const timeout = 5000;
    const python = spawn('python', ['-c', `
import sys
sys.path.insert(0, '${ML_MODEL_DIR}')
from pipeline.anomaly import detect_anomaly
import json
try:
  result = detect_anomaly(${JSON.stringify(telemetry)})
  print(json.dumps(result))
except Exception as e:
  print(json.dumps({"error": str(e)}))
`], {
      cwd: ML_MODEL_DIR,
      timeout
    });

    let stdout = '';
    python.stdout.on('data', (data) => { stdout += data.toString(); });
    python.on('close', () => {
      try {
        const result = JSON.parse(stdout.trim());
        resolve(result.error ? null : result);
      } catch {
        resolve(null);
      }
    });
    python.on('error', () => resolve(null));
  });
}

module.exports = {
  runMLPipeline,
  detectAnomalyQuick,
};
