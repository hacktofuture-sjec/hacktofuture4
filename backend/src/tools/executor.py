from __future__ import annotations

from datetime import UTC, datetime
import os
import re
from dataclasses import dataclass
from typing import Any


from src.adapters.iris_client import IrisClient, IrisClientError
from src.tools.confluence_tool_adapter import ConfluenceToolAdapter
from src.tools.github_adapter import GitHubAdapter
from src.tools.jira_adapter import JiraAdapter
from src.tools.registry import ToolRegistry, ToolRegistryError
from src.tools.slack_adapter import SlackAdapter


@dataclass(frozen=True)
class ToolInvocation:
    name: str
    params: dict[str, Any]


class ToolExecutor:
    def __init__(self, registry: ToolRegistry | None = None) -> None:
        self.registry = registry or self._build_registry()

    def _build_registry(self) -> ToolRegistry:
        registry = ToolRegistry()
        registry.register_tool(
            name="github.fetch_issue",
            description="Fetch GitHub issue details in read-only mode.",
            read_only=True,
            handler=self._execute_github_fetch_issue,
        )
        registry.register_tool(
            name="slack.fetch_channel_messages",
            description="Fetch Slack channel context in read-only mode.",
            read_only=True,
            handler=self._execute_slack_fetch_channel_messages,
        )
        registry.register_tool(
            name="slack.fetch_thread_messages",
            description="Fetch Slack thread context in read-only mode.",
            read_only=True,
            handler=self._execute_slack_fetch_thread_messages,
        )
        registry.register_tool(
            name="jira.fetch_issue",
            description="Fetch Jira issue details in read-only mode.",
            read_only=True,
            handler=self._execute_jira_fetch_issue,
        )
        registry.register_tool(
            name="confluence.fetch_page",
            description="Fetch a Confluence page in read-only mode.",
            read_only=True,
            handler=self._execute_confluence_fetch_page,
        )
        registry.register_tool(
            name="iris.create_incident",
            description="Create an incident in IRIS after human approval.",
            read_only=False,
            handler=self._execute_iris_create_incident,
        )
        return registry

    def _required_env(self, key: str) -> str:
        value = os.getenv(key, "").strip()
        if not value:
            raise ToolRegistryError(f"{key} is not configured")
        return value

    def _required_int_env(self, key: str) -> int:
        raw_value = self._required_env(key)
        try:
            parsed = int(raw_value)
        except ValueError as exc:
            raise ToolRegistryError(f"{key} must be an integer") from exc

        if parsed <= 0:
            raise ToolRegistryError(f"{key} must be a positive integer")
        return parsed

    def _optional_int_env(self, key: str, default: int) -> int:
        raw_value = os.getenv(key, "").strip()
        if not raw_value:
            return default

        try:
            parsed = int(raw_value)
        except ValueError as exc:
            raise ToolRegistryError(f"{key} must be an integer") from exc

        if parsed <= 0:
            raise ToolRegistryError(f"{key} must be a positive integer")
        return parsed

    def _extract_jira_issue_key(self, action: str) -> str:
        match = re.search(r"\b([A-Z][A-Z0-9]*-\d+)\b", action.upper())
        if match is None:
            raise ToolRegistryError(
                "No Jira issue key found in approved action text (expected format PROJECT-123)"
            )
        return match.group(1)

    def _build_invocations(self, action: str) -> list[ToolInvocation]:
        normalized = action.lower()
        invocations: list[ToolInvocation] = []

        if "incident" in normalized and any(keyword in normalized for keyword in ["create", "open", "raise"]):
            invocations.append(
                ToolInvocation(
                    name="iris.create_incident",
                    params=self._build_iris_create_incident_params(action),
                )
            )

        has_pull_request_token = bool(re.search(r"\bpr\b", normalized))
        if "rollback" in normalized or has_pull_request_token or "github" in normalized:
            invocations.append(
                ToolInvocation(
                    name="github.fetch_issue",
                    params={
                        "repository": self._required_env("GITHUB_REPOSITORY"),
                        "issue_number": self._required_int_env("GITHUB_ISSUE_NUMBER"),
                    },
                )
            )

        if any(keyword in normalized for keyword in ["slack", "post", "notify", "channel"]):
            is_thread_fetch = any(keyword in normalized for keyword in ["thread", "reply", "conversation"])
            if is_thread_fetch:
                invocations.append(
                    ToolInvocation(
                        name="slack.fetch_thread_messages",
                        params={
                            "channel": self._required_env("SLACK_CHANNEL_ID"),
                            "thread_ts": self._required_env("SLACK_THREAD_TS"),
                            "limit": self._optional_int_env("SLACK_CONTEXT_LIMIT", 20),
                        },
                    )
                )
            else:
                invocations.append(
                    ToolInvocation(
                        name="slack.fetch_channel_messages",
                        params={
                            "channel": self._required_env("SLACK_CHANNEL_ID"),
                            "limit": self._optional_int_env("SLACK_CONTEXT_LIMIT", 20),
                        },
                    )
                )

        if any(keyword in normalized for keyword in ["jira", "ticket", "issue", "update"]):
            invocations.append(
                ToolInvocation(
                    name="jira.fetch_issue",
                    params={
                        "issue_key": self._extract_jira_issue_key(action),
                    },
                )
            )

        if any(keyword in normalized for keyword in ["confluence", "runbook", "page"]):
            invocations.append(
                ToolInvocation(
                    name="confluence.fetch_page",
                    params={
                        "page_id": self._required_env("CONFLUENCE_PAGE_ID"),
                    },
                )
            )

        if not invocations:
            raise ToolRegistryError("No registered tool mapping found for the approved action")

        return invocations

    def _build_iris_create_incident_params(self, action: str) -> dict[str, Any]:
        normalized = action.lower()

        severity = "medium"
        if any(keyword in normalized for keyword in ["critical", "sev-1", "sev1", "p0"]):
            severity = "critical"
        elif any(keyword in normalized for keyword in ["high", "sev-2", "sev2", "p1"]):
            severity = "high"
        elif any(keyword in normalized for keyword in ["low", "sev-4", "sev4", "p3"]):
            severity = "low"

        tags: list[str] = []
        for tag in ["redis", "latency", "slack", "jira", "rollback", "deployment"]:
            if tag in normalized and tag not in tags:
                tags.append(tag)

        case_name = os.getenv("IRIS_DEFAULT_CASE_NAME", "UniOps Approved Incident")
        quoted = re.findall(r'"([^"]+)"', action)
        if quoted:
            case_name = quoted[0].strip()
        elif "for " in normalized:
            candidate = action.split("for ", 1)[1].strip()
            if candidate:
                case_name = candidate[:120]

        return {
            "case_name": case_name,
            "case_description": f"Created from approved UniOps action: {action}",
            "severity": severity,
            "tags": tags,
            "case_customer": self._optional_int_env("IRIS_CASE_CUSTOMER_ID", 1),
            "case_soc_id": os.getenv("IRIS_CASE_SOC_ID", "").strip(),
        }

    def _failure_payload(
        self,
        *,
        action: str,
        error: str,
        details: list[dict[str, Any]],
        timestamp: str,
    ) -> dict[str, Any]:
        tool_name = details[-1]["tool"] if details else "tool.registry.batch"
        return {
            "tool": tool_name,
            "status": "failed",
            "output": f"Execution failed for action '{action}': {error}",
            "timestamp": timestamp,
            "details": details,
        }

    def execute(self, action: str, action_details: dict[str, Any] | None = None) -> dict[str, Any]:
        timestamp = datetime.now(UTC).isoformat()
        details: list[dict[str, Any]] = []
        effective_action = action

        if not effective_action and isinstance(action_details, dict):
            effective_action = str(action_details.get("intent", "")).strip()

        if not effective_action:
            return self._failure_payload(
                action=action,
                error="No approved action text supplied",
                details=details,
                timestamp=timestamp,
            )

        try:
            invocations = self._build_invocations(effective_action)
        except ToolRegistryError as exc:
            return self._failure_payload(action=effective_action, error=str(exc), details=details, timestamp=timestamp)

        for invocation in invocations:
            try:
                result = self.registry.execute_tool(invocation.name, invocation.params)
            except ToolRegistryError as exc:
                details.append(
                    {
                        "tool": invocation.name,
                        "status": "failed",
                        "output": str(exc),
                    }
                )
                return self._failure_payload(
                    action=effective_action,
                    error=str(exc),
                    details=details,
                    timestamp=timestamp,
                )

            details.append(result)
            if str(result.get("status", "")).lower() != "executed":
                return self._failure_payload(
                    action=effective_action,
                    error=str(result.get("output", "tool returned non-executed status")),
                    details=details,
                    timestamp=timestamp,
                )

        return {
            "tool": "tool.registry.batch" if len(details) > 1 else details[0]["tool"],
            "status": "executed",
            "output": f"Executed {len(details)} tool action(s) successfully.",
            "timestamp": timestamp,
            "details": details,
        }

    def _execute_github_fetch_issue(self, params: dict[str, Any]) -> dict[str, Any]:
        adapter = GitHubAdapter.from_env()
        return adapter.fetch_issue(
            repository=str(params.get("repository", "")),
            issue_number=int(params.get("issue_number", 0)),
        )

    def _execute_slack_fetch_channel_messages(self, params: dict[str, Any]) -> dict[str, Any]:
        adapter = SlackAdapter.from_env()
        return adapter.fetch_channel_messages(
            channel=str(params.get("channel", "")),
            limit=int(params.get("limit", 20)),
        )

    def _execute_slack_fetch_thread_messages(self, params: dict[str, Any]) -> dict[str, Any]:
        adapter = SlackAdapter.from_env()
        return adapter.fetch_thread_messages(
            channel=str(params.get("channel", "")),
            thread_ts=str(params.get("thread_ts", "")),
            limit=int(params.get("limit", 20)),
        )

    def _execute_jira_fetch_issue(self, params: dict[str, Any]) -> dict[str, Any]:
        adapter = JiraAdapter.from_env()
        return adapter.fetch_issue(
            issue_key=str(params.get("issue_key", "")),
        )

    def _execute_confluence_fetch_page(self, params: dict[str, Any]) -> dict[str, Any]:
        adapter = ConfluenceToolAdapter.from_env()
        return adapter.fetch_page(page_id=str(params.get("page_id", "")))

    def _execute_iris_create_incident(self, params: dict[str, Any]) -> dict[str, Any]:
        try:
            adapter = IrisClient.from_env()
            created = adapter.create_incident(
                case_name=str(params.get("case_name", "")).strip(),
                case_description=str(params.get("case_description", "")).strip(),
                severity=str(params.get("severity", "medium")),
                tags=list(params.get("tags", [])),
                case_customer=int(params.get("case_customer", 1)),
                case_soc_id=str(params.get("case_soc_id", "")),
            )
        except (IrisClientError, ValueError) as exc:
            raise ToolRegistryError(f"IRIS incident creation failed: {exc}") from exc

        return {
            "status": "executed",
            "output": f"Created IRIS incident {created.get('case_id', 'unknown')}",
            "incident": {
                "case_id": created.get("case_id"),
                "report_url": created.get("report_url"),
                "case_name": created.get("case_name"),
                "severity": created.get("severity"),
            },
        }


class PlanningToolExecutor:
    """Builds planner-only execution artifacts without external write side effects."""

    def _build_plan_steps(self, action: str, action_details: dict[str, Any] | None) -> list[dict[str, Any]]:
        normalized = action.lower()
        intent = str((action_details or {}).get("intent") or "generic_plan")
        steps: list[dict[str, Any]] = []

        if "rollback" in normalized or "pr" in normalized or intent == "rollback_and_notify":
            steps.extend(
                [
                    {
                        "id": 1,
                        "title": "Collect rollback context",
                        "system": "github",
                        "mode": "planner_only",
                        "operation": "review latest deployment and candidate rollback commit",
                    },
                    {
                        "id": 2,
                        "title": "Prepare rollback PR payload",
                        "system": "github",
                        "mode": "planner_only",
                        "operation": "draft PR title/body and reviewer list",
                    },
                    {
                        "id": 3,
                        "title": "Draft communication updates",
                        "system": "slack+jira",
                        "mode": "planner_only",
                        "operation": "prepare incident broadcast text and Jira update template",
                    },
                ]
            )

        if "diagnostic" in normalized or "read-only" in normalized or intent == "run_diagnostic":
            steps.extend(
                [
                    {
                        "id": len(steps) + 1,
                        "title": "Run diagnostic checklist",
                        "system": "runbook",
                        "mode": "planner_only",
                        "operation": "execute read-only runbook checks and capture findings",
                    }
                ]
            )

        if not steps:
            steps.extend(
                [
                    {
                        "id": 1,
                        "title": "Collect missing context",
                        "system": "knowledge",
                        "mode": "planner_only",
                        "operation": "gather additional evidence before external coordination",
                    },
                    {
                        "id": 2,
                        "title": "Prepare approval-ready action plan",
                        "system": "approval",
                        "mode": "planner_only",
                        "operation": "summarize proposed actions with risk and rollback notes",
                    },
                ]
            )

        return steps

    def execute(self, action: str, action_details: dict[str, Any] | None = None) -> dict[str, Any]:
        timestamp = datetime.now(UTC).isoformat()
        plan_steps = self._build_plan_steps(action=action, action_details=action_details)
        intent = str((action_details or {}).get("intent") or "generic_plan")
        risk_hint = (action_details or {}).get("risk_hint")

        return {
            "tool": "planner.external_action_plan",
            "status": "plan_generated",
            "output": "Generated planner-only execution plan. No external write operations were performed.",
            "timestamp": timestamp,
            "execution_mode": "planner_only",
            "no_write_policy": True,
            "plan": {
                "intent": intent,
                "summary": action,
                "approval_required": bool((action_details or {}).get("approval_required", True)),
                "risk_hint": risk_hint,
                "prechecks": [
                    "Confirm incident scope and blast radius.",
                    "Validate runbook and recent change history.",
                    "Capture approver decision and comment.",
                ],
                "steps": plan_steps,
                "rollback": [
                    "If plan is not approved, retain current state and request additional evidence.",
                    "If post-approval checks fail, halt and escalate to incident commander.",
                ],
            },
        }
