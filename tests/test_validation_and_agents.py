import unittest

from agents.verifier_agent import compute_spatial_correlation, magnitude_cross_check, verifier_agent
from agents.triage_agent import classify_gas_threat, determine_urgency, triage_agent


class TestValidationAndAgents(unittest.TestCase):
    def _make_node(self, node_id: str, magnitude: float, gas: float, pir: int, duration: int):
        return {
            "node_id": node_id,
            "lat": 12.9141,
            "lng": 74.8560,
            "seismic_magnitude": magnitude,
            "gas_ppm": gas,
            "pir_count": pir,
            "event_duration_ms": duration,
            "timestamp": "2026-04-16T10:00:00",
        }

    def _base_state(self, nodes):
        return {
            "raw_nodes": nodes,
            "alert_id": "TEST1234",
            "verifier": None,
            "triage": None,
            "logistics": None,
            "sitrep": None,
            "pipeline_status": "running",
            "abort_reason": None,
            "processing_log": [],
        }

    def test_spatial_correlation_single_vs_cluster(self):
        single = [self._make_node("NM-1", 5.0, 400, 3, 1200)]
        cluster = [
            self._make_node("NM-1", 4.2, 450, 3, 1000),
            self._make_node("NM-2", 4.0, 420, 2, 900),
            self._make_node("NM-3", 3.8, 410, 2, 950),
        ]

        self.assertEqual(compute_spatial_correlation(single)["correlation_type"], "single_node")
        self.assertEqual(compute_spatial_correlation(cluster)["correlation_type"], "cluster")

    def test_magnitude_cross_check(self):
        correlated_nodes = [
            self._make_node("NM-1", 4.2, 450, 3, 1200),
            self._make_node("NM-2", 4.0, 420, 3, 1100),
        ]
        uncorrelated_nodes = [
            self._make_node("NM-1", 1.0, 110, 1, 300),
            self._make_node("NM-2", 8.5, 120, 0, 200),
        ]

        self.assertTrue(magnitude_cross_check(correlated_nodes))
        self.assertFalse(magnitude_cross_check(uncorrelated_nodes))

    def test_verifier_aborts_false_alarm(self):
        nodes = [self._make_node("NM-1", 1.2, 80, 0, 120)]
        final_state = verifier_agent(self._base_state(nodes))

        self.assertEqual(final_state["pipeline_status"], "aborted")
        self.assertIsNotNone(final_state["abort_reason"])
        self.assertFalse(final_state["verifier"]["is_genuine"])

    def test_verifier_allows_genuine_cluster(self):
        nodes = [
            self._make_node("NM-1", 5.1, 450, 5, 1200),
            self._make_node("NM-2", 4.9, 430, 4, 1100),
        ]
        final_state = verifier_agent(self._base_state(nodes))

        self.assertEqual(final_state["pipeline_status"], "running")
        self.assertTrue(final_state["verifier"]["is_genuine"])
        self.assertGreaterEqual(final_state["verifier"]["confidence"], 0.7)

    def test_gas_threat_rules(self):
        high = classify_gas_threat(700, 1)
        mid = classify_gas_threat(320, 1)

        self.assertEqual(high["gas_threat"], "lethal")
        self.assertEqual(high["entry_protocol"], "hazmat")
        self.assertIn(mid["gas_threat"], ["warning", "lethal"])  # model can classify more conservatively

    def test_urgency_calculation(self):
        urgent = determine_urgency(85, "lethal", 4)
        low = determine_urgency(20, "clear", 30)

        self.assertIn(urgent["urgency"], ["extreme", "immediate"])
        self.assertEqual(low["urgency"], "low")
        self.assertGreaterEqual(urgent["recommended_team_size"], low["recommended_team_size"])

    def test_triage_outputs_required_fields(self):
        nodes = [
            self._make_node("NM-1", 5.0, 650, 8, 1400),
            self._make_node("NM-2", 4.4, 420, 3, 900),
        ]

        out = triage_agent(self._base_state(nodes))
        triage = out["triage"]

        for key in [
            "survivability_score",
            "estimated_persons",
            "life_sign_pattern",
            "gas_threat",
            "entry_protocol",
            "urgency",
            "time_sensitivity_minutes",
            "recommended_team_size",
            "equipment_checklist",
        ]:
            self.assertIn(key, triage)

        self.assertTrue(len(triage["equipment_checklist"]) > 0)


if __name__ == "__main__":
    unittest.main()
