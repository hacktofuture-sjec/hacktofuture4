const mongoose = require('mongoose');
const Complaint = require('../models/Complaint');

/**
 * ⚡ Multi-Factor Smart City Priority & SLA Engine
 * Evaluates AI severity, critical safety keyword overrides, cluster density, and computes exact SLA deadlines.
 */
const calculatePriority = async (severity, clusterId, title = '') => {
  // 1. Initial AI Severity Mapping
  const severityMap = { Low: 1, Medium: 2, High: 3 };
  let score = severityMap[severity] || 2;

  // 2. Critical Safety Keyword Overrides (Enforce High Priority for immediate hazards)
  const lowTitle = (title || '').toLowerCase();
  const criticalSafetyTriggers = [
    'live wire', 'sparking', 'spark', 'electric shock', 'open manhole', 'manhole open',
    'deep pothole', 'accident', 'danger', 'hazard', 'emergency', 'burst pipe',
    'pipe burst', 'flooding', 'flooded', 'toxic', 'collapsed', 'sinkhole',
    'sewage overflow', 'fire', 'ambulance', 'hospital'
  ];

  const hasCriticalTrigger = criticalSafetyTriggers.some(term => lowTitle.includes(term));
  if (hasCriticalTrigger) {
    score = 3; // Force High Priority
  }

  // 3. Cluster Density Escalation (Multiple citizens reporting in the same hotspot)
  if (mongoose.connection.readyState === 1 && clusterId !== null && clusterId !== undefined) {
    try {
      const clusterCount = await Complaint.countDocuments({ clusterId });
      if (clusterCount >= 5) {
        score = 3; // Escalated to High due to critical cluster volume
      } else if (clusterCount >= 3) {
        score = Math.max(score, 2); // Escalated to at least Medium
      }
    } catch (e) {
      console.warn('Cluster count skipped:', e.message);
    }
  }

  // 4. Assign Final Priority Label
  let priorityLabel = 'Medium';
  if (score >= 3) priorityLabel = 'High';
  else if (score === 2) priorityLabel = 'Medium';
  else priorityLabel = 'Low';

  // 5. SLA Calculation (Deadlines)
  const now = new Date();
  let deadline = new Date();

  if (priorityLabel === 'High') {
    // 🚨 High Priority: 12-hour resolution SLA
    deadline.setHours(now.getHours() + 12);
  } else if (priorityLabel === 'Medium') {
    // ⚠️ Medium Priority: 36-hour resolution SLA
    deadline.setHours(now.getHours() + 36);
  } else {
    // 🟢 Low Priority: 72-hour (3 days) resolution SLA
    deadline.setHours(now.getHours() + 72);
  }

  return { priorityScore: score, priorityLabel, deadline };
};

module.exports = { calculatePriority };
