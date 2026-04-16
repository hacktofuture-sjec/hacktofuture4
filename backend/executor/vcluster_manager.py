from __future__ import annotations


class VClusterManager:
    async def create(self, incident_id: str) -> str:
        return f"fix-sandbox-{incident_id}"

    async def validate(self, cluster_name: str) -> bool:
        del cluster_name
        return True

    async def delete(self, cluster_name: str) -> None:
        del cluster_name
        return None
