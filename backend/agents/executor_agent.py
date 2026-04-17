from __future__ import annotations

from datetime import datetime

from models.enums import ExecutorStatus
from models.schemas import ExecutorResult


class ExecutorAgent:
    def __init__(self, vcluster_mgr, action_runner):
        self.vcluster_mgr = vcluster_mgr
        self.action_runner = action_runner

    async def execute(self, incident_id: str, action_command: str) -> ExecutorResult:
        cluster_name = await self.vcluster_mgr.create(incident_id)

        sandbox_result = await self.action_runner.run(action_command, sandbox=True)
        if not sandbox_result.ok:
            await self.vcluster_mgr.delete(cluster_name)
            return ExecutorResult(
                action=action_command,
                status=ExecutorStatus.SANDBOX_FAILED,
                sandbox_validated=False,
                rollback_needed=False,
                execution_timestamp=datetime.utcnow().isoformat() + "Z",
                error=sandbox_result.error,
            )

        sandbox_validated = await self.vcluster_mgr.validate(cluster_name)
        if not sandbox_validated:
            await self.vcluster_mgr.delete(cluster_name)
            return ExecutorResult(
                action=action_command,
                status=ExecutorStatus.SANDBOX_FAILED,
                sandbox_validated=False,
                rollback_needed=False,
                execution_timestamp=datetime.utcnow().isoformat() + "Z",
                error="sandbox_validation_failed",
            )

        prod_result = await self.action_runner.run(action_command, sandbox=False)
        await self.vcluster_mgr.delete(cluster_name)

        if not prod_result.ok:
            return ExecutorResult(
                action=action_command,
                status=ExecutorStatus.PRODUCTION_FAILED,
                sandbox_validated=True,
                rollback_needed=True,
                execution_timestamp=datetime.utcnow().isoformat() + "Z",
                error=prod_result.error,
            )

        return ExecutorResult(
            action=action_command,
            status=ExecutorStatus.SUCCESS,
            sandbox_validated=True,
            rollback_needed=False,
            execution_timestamp=datetime.utcnow().isoformat() + "Z",
            error=None,
        )
