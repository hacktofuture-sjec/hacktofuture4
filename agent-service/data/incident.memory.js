/**
 * Incident Memory
 * In-memory storage for incident tracking (optional but useful for later)
 * Can be replaced with a database later
 */

class IncidentMemory {
  constructor() {
    this.incidents = new Map();
    this.decisions = new Map();
    this.remediations = new Map();
  }

  /**
   * Store an incident
   * @param {Object} incident - Incident data
   */
  storeIncident(incident) {
    const incidentId = incident.id || `INC-${Date.now()}`;
    this.incidents.set(incidentId, {
      ...incident,
      id: incidentId,
      created_at: new Date(),
      status: 'open'
    });
    return incidentId;
  }

  /**
   * Retrieve an incident
   * @param {string} incidentId - Incident ID
   * @returns {Object} Incident data
   */
  getIncident(incidentId) {
    return this.incidents.get(incidentId);
  }

  /**
   * Get all incidents
   * @returns {Array} All incidents
   */
  getAllIncidents() {
    return Array.from(this.incidents.values());
  }

  /**
   * Update incident status
   * @param {string} incidentId - Incident ID
   * @param {string} status - New status
   */
  updateIncidentStatus(incidentId, status) {
    const incident = this.incidents.get(incidentId);
    if (incident) {
      incident.status = status;
      incident.updated_at = new Date();
    }
  }

  /**
   * Store a decision
   * @param {Object} decision - Decision data
   */
  storeDecision(decision) {
    const decisionId = decision.id || `DEC-${Date.now()}`;
    this.decisions.set(decisionId, {
      ...decision,
      id: decisionId,
      created_at: new Date()
    });
    return decisionId;
  }

  /**
   * Store a remediation
   * @param {Object} remediation - Remediation data
   */
  storeRemediation(remediation) {
    const remediationId = remediation.id || `REM-${Date.now()}`;
    this.remediations.set(remediationId, {
      ...remediation,
      id: remediationId,
      created_at: new Date()
    });
    return remediationId;
  }

  /**
   * Clear all data (useful for testing)
   */
  clear() {
    this.incidents.clear();
    this.decisions.clear();
    this.remediations.clear();
  }
}

module.exports = new IncidentMemory();
