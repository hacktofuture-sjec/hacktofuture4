import os
import unittest

from pipeline.graph import should_continue
from agents.logistics_agent import calculate_debris_probability, find_best_routes


class TestPipelineAndDashboard(unittest.TestCase):
    def test_should_continue_routing(self):
        self.assertEqual(should_continue({"pipeline_status": "aborted"}), "abort")
        self.assertEqual(should_continue({"pipeline_status": "running"}), "continue")

    def test_debris_probability_monotonicity(self):
        collapse_lat, collapse_lng, magnitude = 12.9141, 74.8560, 5.0
        near = calculate_debris_probability(12.9142, 74.8561, collapse_lat, collapse_lng, magnitude)
        far = calculate_debris_probability(12.9300, 74.8700, collapse_lat, collapse_lng, magnitude)

        self.assertGreater(near, far)
        self.assertGreaterEqual(near, 0.0)
        self.assertLessEqual(near, 1.0)

    def test_route_builder_has_expected_fields(self):
        routes = find_best_routes(12.9141, 74.8560, 5.2)

        for key in ["entry_primary", "entry_alternate", "assembly_point", "debris_zones", "exclusion_radius_m", "eta_estimate_minutes"]:
            self.assertIn(key, routes)

        self.assertGreater(routes["exclusion_radius_m"], 0)
        self.assertGreater(routes["eta_estimate_minutes"], 0)

    def test_model_artifacts_exist(self):
        expected = [
            "models/seismic_model.keras",
            "models/gas_model.pkl",
            "models/survivor_model.pkl",
            "models/survivor_scaler.pkl",
            "models/validator_model.pkl",
        ]
        missing = [p for p in expected if not os.path.exists(p)]
        self.assertEqual(missing, [])

    def test_dashboard_map_stack_files_exist(self):
        expected = [
            "dashboard/src/app/page.tsx",
            "dashboard/src/components/MapPanel.tsx",
            "dashboard/src/components/AlertFeed.tsx",
            "dashboard/src/components/SitrepPanel.tsx",
            "dashboard/src/components/SystemHealth.tsx",
        ]
        missing = [p for p in expected if not os.path.exists(p)]
        self.assertEqual(missing, [])


if __name__ == "__main__":
    unittest.main()
