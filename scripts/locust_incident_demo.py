from locust import HttpUser, task, between


class AuthStormUser(HttpUser):
    # Free-tier friendly pacing: still bursty enough to surface rate-limit behavior.
    wait_time = between(1.5, 4.0)

    @task(3)
    def health_check(self):
        self.client.get("/health", name="GET /health")

    @task(5)
    def unauthorized_projects(self):
        # Intentionally unauthenticated to simulate session/auth failure storm.
        with self.client.get(
            "/api/projects",
            name="GET /api/projects (unauthorized)",
            catch_response=True,
        ) as response:
            if response.status_code == 401:
                response.success()
            else:
                response.failure(
                    f"Expected 401 but got {response.status_code}: {response.text[:120]}"
                )
