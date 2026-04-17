const Complaint = require('../models/Complaint');

const calculatePriority = async (severity, clusterId) => {
  // 1. Initial Mapping
  const severityMap = { Low: 1, Medium: 2, High: 3 };
  let score = severityMap[severity] || 1;

  // 2. Volume Escalation
  const clusterSizeCount = await Complaint.countDocuments({ clusterId });
  if (clusterSizeCount > 5) score = Math.max(score, 2); // At least Med
  if (clusterSizeCount > 15) score = 3; // At least High

  // 3. Labels
  let priorityLabel = 'Low';
  if (score >= 3) priorityLabel = 'High';
  else if (score >= 2) priorityLabel = 'Medium';

  // 4. SLA Calculation (Deadlines)
  const now = new Date();
  let deadline = new Date();

  // Rules: High=12h, Med=48h, Low=1 Week
  if (priorityLabel === 'High') {
    deadline.setHours(now.getHours() + 12);
  } else if (priorityLabel === 'Medium') {
    deadline.setHours(now.getHours() + 48);
  } else {
    deadline.setDate(now.getDate() + 7);
  }

  return { priorityScore: score, priorityLabel, deadline };
};

module.exports = { calculatePriority };
