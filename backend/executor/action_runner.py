from __future__ import annotations

from dataclasses import dataclass


ALLOWED_PREFIXES = [
    "kubectl rollout restart",
    "kubectl set resources",
    "kubectl scale deployment",
    "kubectl rollout undo",
    "kubectl set env",
    "kubectl set image",
]


@dataclass
class ActionRunResult:
    ok: bool
    error: str | None = None


def validate_command(command: str) -> bool:
    return any(command.startswith(prefix) for prefix in ALLOWED_PREFIXES)


class ActionRunner:
    async def run(self, command: str, sandbox: bool) -> ActionRunResult:
        del sandbox
        if not validate_command(command):
            return ActionRunResult(ok=False, error="command_not_allowlisted")
        # Deterministic simulation for hackathon flow.
        return ActionRunResult(ok=True, error=None)
