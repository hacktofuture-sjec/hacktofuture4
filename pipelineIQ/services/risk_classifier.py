from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from config import settings
from models.pipeline_run import PipelineRun
from models.workspace import Workspace
from services.github_app import fetch_compare_details, fetch_pull_request_review_state
from services.llm_gateway import call_with_fallback

RISK_SYSTEM_PROMPT = """
SYSTEM PROMPT — Pipeline IQ Risk Classifier Agent

You are the Risk Classifier Agent for Pipeline IQ, an agentic CI/CD
orchestration system. Your sole responsibility is to receive a
pre-computed risk score and a structured diagnosis from the
Diagnosis Agent, and produce a clear, plain-English explanation
of why this deployment carries that level of risk.

CRITICAL RULES:
- You DO NOT compute or change the risk score. The score is
  deterministic and has already been calculated by the rule-based
  scorer before this prompt was called.
- You DO NOT decide what action to take. The router decides that.
- You ONLY explain the score in human-readable language so the
  engineer can understand and act.
- You MUST return valid JSON only. No preamble, no markdown
  fences, no explanation outside the JSON object.

INPUT FORMAT:
You will receive a JSON object with the following fields:
  - risk_score: integer 0–100
  - risk_band: "low" | "medium" | "high" | "critical"
  - environment: string
  - diff_lines: integer
  - file_types: list of strings (e.g. ["db_migration", "business_logic"])
  - api_surface: string
  - commit_signal: string
  - historical_failures: integer (failures in last 7 days)
  - last_deploy_caused_incident: boolean
  - downstream_dependents: integer
  - is_shared_library: boolean
  - vulnerable_dependency: boolean
  - diagnosis: object containing failure_type, root_cause,
    confidence_score, suggested_fix

SCORING REFERENCE (for your explanation only):
  Environment:     dev=0, staging=+8, pre-prod=+18, production=+30
  Git diff:        1-20=+2, 21-100=+5, 101-500=+9, 500+=+14
  File type:       tests=0, docs=+1, business_logic=+7,
                   infra_as_code=+14, auth=+16, db_migration=+18,
                   secrets=+20
  API surface:     static=0, frontend=+2, internal_api=+5,
                   public_api_schema=+12, queue_schema=+14
  Commit signal:   2+_reviewers=-8, 1_reviewer=-3, no_pr=+10,
                   hotfix_wip_msg=+5, first_time_deployer=+7,
                   off_hours=+3
  History:         no_failures=0, 1_failure=+3, 2-3_failures=+6,
                   last_deploy_incident=+8, 4+_failures=+10
  Blast radius:    isolated=0, 1-2_deps=+2, 3-5_deps=+5,
                   vulnerable_dep=+8, shared_library=+10

OUTPUT FORMAT — return exactly this JSON, nothing else:
{
  "risk_score": <integer, echoed from input>,
  "risk_band": "<low|medium|high|critical>",
  "top_contributors": [
    "<single sentence describing the biggest risk factor>",
    "<single sentence describing second biggest factor>",
    "<single sentence describing third biggest factor>"
  ],
  "plain_english_summary": "<2-3 sentence plain English explanation
    written for a DevOps engineer who will decide whether to approve.
    Be specific: name the files, the environment, the failure history.
    Do not use jargon. Do not say 'the risk score is X' — explain
    WHY it is risky in human terms.>",
  "recommended_action": "<one of: auto_fix | notify_and_wait |
    require_approval | block_and_page>",
  "reversibility_note": "<one sentence: how easy is this to roll back
    if it goes wrong?>"
}
""".strip()

ENVIRONMENT_POINTS = {
    "dev": 0,
    "staging": 8,
    "pre-prod": 18,
    "production": 30,
}

FILE_TYPE_POINTS = {
    "tests": 0,
    "docs": 1,
    "business_logic": 7,
    "infra_as_code": 14,
    "auth": 16,
    "db_migration": 18,
    "secrets": 20,
}

API_SURFACE_POINTS = {
    "static": 0,
    "frontend": 2,
    "internal_api": 5,
    "public_api_schema": 12,
    "queue_schema": 14,
}


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    candidate = value.strip()
    if not candidate:
        return None
    try:
        return datetime.fromisoformat(candidate.replace("Z", "+00:00"))
    except ValueError:
        return None


def _ensure_utc_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _environment_for_branch(branch: str, workspace: Workspace) -> str:
    normalized = (branch or "").strip().lower()
    production_branch = (workspace.risk_profile.production_branch or "main").strip().lower()

    if normalized in {production_branch, "main", "master", "production", "prod"}:
        return "production"
    if any(token in normalized for token in ("pre-prod", "preprod", "uat", "qa", "release")):
        return "pre-prod"
    if "staging" in normalized or normalized == "stage":
        return "staging"
    return "dev"


def _severity_rank(value: str, order: list[str]) -> int:
    try:
        return order.index(value)
    except ValueError:
        return -1


def _classify_file_types(files: list[dict[str, Any]]) -> list[str]:
    if not files:
        return []

    detected: set[str] = set()
    code_extensions = {
        ".py", ".js", ".jsx", ".ts", ".tsx", ".go", ".java", ".rb", ".php", ".cs", ".rs",
    }

    for file_item in files:
        filename = (file_item.get("filename") or "").lower()
        if not filename:
            continue

        specific_matches: set[str] = set()
        if any(token in filename for token in ("secret", "secrets", ".env", "vault", "credential", ".pem", ".key")):
            specific_matches.add("secrets")
        if any(token in filename for token in ("alembic", "flyway", "liquibase", "migration", "migrations", "schema.sql")) or filename.endswith(".sql"):
            specific_matches.add("db_migration")
        if any(token in filename for token in ("auth", "security", "jwt", "permission", "rbac", "oauth")):
            specific_matches.add("auth")
        if any(token in filename for token in ("terraform", "helm", "k8s", "kubernetes", "docker-compose", ".github/workflows", "ansible", "chart/")) or filename.endswith((".tf", ".tfvars", ".yaml", ".yml")):
            specific_matches.add("infra_as_code")
        if any(token in filename for token in ("readme", "docs/", "/docs", ".md", ".rst")):
            specific_matches.add("docs")
        if any(token in filename for token in ("test", "tests", "spec", "__tests__")):
            specific_matches.add("tests")
        if filename.endswith(tuple(code_extensions)) and not specific_matches.intersection({"auth", "db_migration", "infra_as_code", "secrets"}):
            specific_matches.add("business_logic")

        detected.update(specific_matches)

    return sorted(detected, key=lambda item: FILE_TYPE_POINTS.get(item, 0), reverse=True)


def _classify_api_surface(files: list[dict[str, Any]]) -> str:
    winner = "static"
    ordering = ["static", "frontend", "internal_api", "public_api_schema", "queue_schema"]

    for file_item in files:
        filename = (file_item.get("filename") or "").lower()
        patch = (file_item.get("patch") or "").lower()
        candidate = "static"

        if any(token in filename for token in ("kafka", "rabbitmq", "avro", "schema-registry", "queue", "event", ".proto")):
            candidate = "queue_schema"
        elif any(token in filename for token in ("openapi", "swagger", "graphql", "schema", "contract")):
            candidate = "public_api_schema"
        elif any(token in filename for token in ("router", "routes", "controller", "endpoint", "api/")):
            candidate = "internal_api"
        elif filename.endswith((".jsx", ".tsx", ".vue")) or any(token in filename for token in ("frontend/", "components/", "pages/", "src/pages/")):
            candidate = "frontend"
        elif filename.endswith((".css", ".scss", ".png", ".jpg", ".svg")) or any(token in filename for token in ("public/", "assets/", "static/")):
            candidate = "static"

        if "requestbody" in patch or "responses:" in patch or "type query" in patch:
            candidate = "public_api_schema"
        if any(token in patch for token in ("kafka", "rabbitmq", "topic", "consumer", "producer")):
            candidate = "queue_schema"

        if _severity_rank(candidate, ordering) > _severity_rank(winner, ordering):
            winner = candidate

    return winner


def _commit_message(raw_event: dict[str, Any]) -> str:
    workflow_run = raw_event.get("workflow_run") or {}
    head_commit = workflow_run.get("head_commit") or {}
    return ((head_commit.get("message") or workflow_run.get("display_title") or "")).strip()


def _commit_signal_list(
    *,
    raw_event: dict[str, Any],
    approved_reviewers: int,
    previous_run_count: int,
    completed_at: datetime | None,
) -> tuple[list[str], int]:
    signals: list[str] = []
    points = 0

    pull_requests = ((raw_event.get("workflow_run") or {}).get("pull_requests") or [])
    if not pull_requests:
        signals.append("no_pr")
        points += 10
    elif approved_reviewers >= 2:
        signals.append("2+_reviewers")
        points -= 8
    elif approved_reviewers == 1:
        signals.append("1_reviewer")
        points -= 3

    commit_message = _commit_message(raw_event).lower()
    if "hotfix" in commit_message or "wip" in commit_message:
        signals.append("hotfix_wip_msg")
        points += 5

    if previous_run_count == 0:
        signals.append("first_time_deployer")
        points += 7

    if completed_at is not None:
        if completed_at.weekday() >= 5 or completed_at.hour < 9 or completed_at.hour >= 17:
            signals.append("off_hours")
            points += 3

    return signals, points


def _history_points(failure_count: int, last_deploy_caused_incident: bool) -> tuple[int, str]:
    if failure_count <= 0:
        points = 0
        label = "no_failures"
    elif failure_count == 1:
        points = 3
        label = "1_failure"
    elif failure_count <= 3:
        points = 6
        label = "2-3_failures"
    else:
        points = 10
        label = "4+_failures"

    if last_deploy_caused_incident:
        points += 8
        label = f"{label}+last_deploy_incident"
    return points, label


def _blast_radius_points(
    *,
    downstream_dependents: int,
    is_shared_library: bool,
    vulnerable_dependency: bool,
) -> tuple[int, str]:
    points = 0
    labels: list[str] = []

    if downstream_dependents <= 0:
        labels.append("isolated")
    elif downstream_dependents <= 2:
        points += 2
        labels.append("1-2_deps")
    else:
        points += 5
        labels.append("3-5_deps")

    if vulnerable_dependency:
        points += 8
        labels.append("vulnerable_dep")
    if is_shared_library:
        points += 10
        labels.append("shared_library")

    return points, "+".join(labels)


def _band_for_score(score: int, auto_fix_below: int, require_approval_above: int) -> str:
    if score <= auto_fix_below:
        return "low"
    if score <= require_approval_above:
        return "medium"
    return "high"


def _action_for_score(score: int, auto_fix_below: int, require_approval_above: int) -> str:
    if score <= auto_fix_below:
        return "auto_fix"
    if score <= require_approval_above:
        return "require_approval"
    return "block_and_page"


def _reversibility_note(file_types: list[str], diff_lines: int) -> str:
    if "db_migration" in file_types or "secrets" in file_types:
        return "Rollback is hard because schema or secret changes can leave persistent state behind."
    if diff_lines >= 500 or "infra_as_code" in file_types:
        return "Rollback is possible, but the broad infrastructure footprint means recovery needs a careful staged revert."
    return "Rollback should be straightforward because the change footprint is contained and mostly code-level."


def _fallback_explanation(payload: dict[str, Any], breakdown: list[dict[str, Any]]) -> dict[str, Any]:
    changed_files = payload.get("changed_files") or []
    files_text = ", ".join(changed_files[:3]) or "the changed files in this run"
    history_count = payload.get("historical_failures", 0)
    environment = payload.get("environment", "dev")
    diagnosis = payload.get("diagnosis") or {}
    top_contributors = [entry["explanation"] for entry in breakdown[:3] if entry["points"] > 0]
    while len(top_contributors) < 3:
        top_contributors.append("The remaining risk comes from the combined footprint of this deployment.")

    if history_count <= 0:
        history_text = "There have been no recent failures on this service."
    elif history_count == 1:
        history_text = "There was one failure in the last seven days."
    else:
        history_text = f"There were {history_count} failures in the last seven days."

    summary = (
        f"This deployment targets {environment} and touches {files_text}, which raises the chance of runtime drift if the fix is incomplete. "
        f"{history_text} The current failure points to {diagnosis.get('root_cause') or diagnosis.get('failure_type') or 'an application-level issue'}, so this change deserves extra review before rollout."
    )

    return {
        "risk_score": payload["risk_score"],
        "risk_band": payload["risk_band"],
        "top_contributors": top_contributors[:3],
        "plain_english_summary": summary,
        "recommended_action": _action_for_score(
            payload["risk_score"],
            int(payload.get("auto_fix_below") or 30),
            int(payload.get("require_approval_above") or 60),
        ),
        "reversibility_note": _reversibility_note(payload.get("file_types") or [], payload.get("diff_lines", 0)),
    }


def _sanitize_risk_report(payload: dict[str, Any], raw: dict[str, Any], breakdown: list[dict[str, Any]]) -> dict[str, Any]:
    fallback = _fallback_explanation(payload, breakdown)
    report = raw if isinstance(raw, dict) else {}

    top_contributors = report.get("top_contributors")
    if not isinstance(top_contributors, list):
        top_contributors = fallback["top_contributors"]
    top_contributors = [str(item).strip() for item in top_contributors if str(item).strip()]
    if not top_contributors:
        top_contributors = fallback["top_contributors"]

    recommended_action = str(report.get("recommended_action") or "").strip()
    if recommended_action not in {"auto_fix", "notify_and_wait", "require_approval", "block_and_page"}:
        recommended_action = _action_for_score(
            payload["risk_score"],
            int(payload.get("auto_fix_below") or 30),
            int(payload.get("require_approval_above") or 60),
        )

    return {
        "risk_score": payload["risk_score"],
        "risk_band": payload["risk_band"],
        "top_contributors": top_contributors[:3],
        "plain_english_summary": str(report.get("plain_english_summary") or fallback["plain_english_summary"]).strip(),
        "recommended_action": recommended_action,
        "reversibility_note": str(report.get("reversibility_note") or fallback["reversibility_note"]).strip(),
    }


def _is_shared_library(repo_full_name: str) -> bool:
    repo_name = repo_full_name.rsplit("/", 1)[-1].lower()
    return any(token in repo_name for token in ("shared", "common", "core", "sdk", "library", "lib"))


async def build_risk_payload(
    *,
    workspace: Workspace,
    pipeline_run: PipelineRun,
    compare_details: dict[str, Any],
    diagnosis_report: dict[str, Any],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    raw_event = pipeline_run.raw_event or {}
    completed_at = _ensure_utc_datetime(
        _parse_datetime((raw_event.get("workflow_run") or {}).get("updated_at")) or pipeline_run.updated_at
    )
    environment = _environment_for_branch(pipeline_run.branch or "", workspace)
    diff_lines = int(compare_details.get("total_changed_lines") or 0)
    changed_files = list(compare_details.get("changed_files") or [])
    file_types = _classify_file_types(list(compare_details.get("files") or []))
    api_surface = _classify_api_surface(list(compare_details.get("files") or []))
    is_shared_library = _is_shared_library(pipeline_run.repository_full_name)
    vulnerable_dependency = False
    downstream_dependents = 0

    previous_runs = await PipelineRun.find(
        PipelineRun.workspace_id == workspace.id,
        PipelineRun.repository_full_name == pipeline_run.repository_full_name,
        PipelineRun.event_type == "workflow_run",
    ).to_list()
    previous_runs = [run for run in previous_runs if run.id != pipeline_run.id]

    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent_failure_count = len([
        run for run in previous_runs
        if (_ensure_utc_datetime(run.updated_at) or datetime.min.replace(tzinfo=timezone.utc)) >= seven_days_ago
        and run.health_status == "failing"
    ])

    previous_runs_sorted = sorted(
        previous_runs,
        key=lambda run: _ensure_utc_datetime(run.updated_at) or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    last_deploy_caused_incident = bool(previous_runs_sorted and previous_runs_sorted[0].health_status == "failing")

    pull_requests = ((raw_event.get("workflow_run") or {}).get("pull_requests") or [])
    pull_number = None
    if pull_requests:
        pull_number = pull_requests[0].get("number")

    approved_reviewers = 0
    if pipeline_run.installation_id and pull_number:
        try:
            review_state = await fetch_pull_request_review_state(
                installation_id=pipeline_run.installation_id,
                repository_full_name=pipeline_run.repository_full_name,
                pull_number=pull_number,
            )
            approved_reviewers = int(review_state.get("approved_reviewers") or 0)
        except Exception:
            approved_reviewers = 0

    commit_signals, commit_points = _commit_signal_list(
        raw_event=raw_event,
        approved_reviewers=approved_reviewers,
        previous_run_count=len(previous_runs),
        completed_at=completed_at,
    )

    environment_points = ENVIRONMENT_POINTS[environment]
    if diff_lines <= 0:
        diff_points = 0
        diff_label = "0_lines"
    elif diff_lines <= 20:
        diff_points = 2
        diff_label = "1-20"
    elif diff_lines <= 100:
        diff_points = 5
        diff_label = "21-100"
    elif diff_lines <= 500:
        diff_points = 9
        diff_label = "101-500"
    else:
        diff_points = 14
        diff_label = "500+"

    file_points = sum(FILE_TYPE_POINTS.get(file_type, 0) for file_type in file_types)
    api_points = API_SURFACE_POINTS.get(api_surface, 0)
    history_points, history_label = _history_points(recent_failure_count, last_deploy_caused_incident)
    blast_points, blast_label = _blast_radius_points(
        downstream_dependents=downstream_dependents,
        is_shared_library=is_shared_library,
        vulnerable_dependency=vulnerable_dependency,
    )

    score = max(0, min(100, environment_points + diff_points + file_points + api_points + commit_points + history_points + blast_points))
    auto_fix_below = int(workspace.risk_profile.auto_fix_below)
    require_approval_above = int(workspace.risk_profile.require_approval_above)
    risk_band = _band_for_score(score, auto_fix_below, require_approval_above)
    commit_signal = ",".join(commit_signals) if commit_signals else "none"

    diagnosis_payload = {
        "failure_type": diagnosis_report.get("error_type") or "Runtime Failure",
        "root_cause": (diagnosis_report.get("possible_causes") or ["Unknown root cause"])[0],
        "confidence_score": 0.82 if changed_files else 0.58,
        "suggested_fix": diagnosis_report.get("latest_working_change") or "Inspect the failing step and recent change set.",
    }

    breakdown = [
        {
            "label": "environment",
            "title": "Environment",
            "value": environment,
            "points": environment_points,
            "detail": f"Deployment branch maps to the {environment} environment.",
            "explanation": f"The deployment is headed to {environment}, which carries more user-facing blast radius than a local or isolated branch.",
        },
        {
            "label": "git_diff",
            "title": "Git diff",
            "value": diff_label,
            "points": diff_points,
            "detail": f"Approximately {diff_lines} changed lines were detected in the compare diff.",
            "explanation": f"The diff spans about {diff_lines} changed lines, which makes review quality and rollback confidence weaker.",
        },
        {
            "label": "file_types",
            "title": "Critical file types",
            "value": ", ".join(file_types) or "none detected",
            "points": file_points,
            "detail": "Sum of the highest-risk file classes touched by this run.",
            "explanation": f"The changed files include {', '.join(file_types) or 'no high-risk files'}, which touches higher-risk parts of the stack.",
        },
        {
            "label": "api_surface",
            "title": "API / static surface",
            "value": api_surface,
            "points": api_points,
            "detail": "Detected surface area affected by the diff.",
            "explanation": f"The change affects the {api_surface.replace('_', ' ')} surface, so downstream compatibility matters.",
        },
        {
            "label": "commit_signals",
            "title": "Commit / author signals",
            "value": commit_signal,
            "points": commit_points,
            "detail": "Review coverage, deploy timing, and commit message signals.",
            "explanation": f"The authoring signals were {commit_signal or 'neutral'}, which changes how much human review confidence we have.",
        },
        {
            "label": "history",
            "title": "Failure history",
            "value": history_label,
            "points": history_points,
            "detail": f"{recent_failure_count} failures were found in the last seven days.",
            "explanation": f"The service has {recent_failure_count} failures in the last seven days, so the recent delivery pattern is less stable.",
        },
        {
            "label": "blast_radius",
            "title": "Blast radius",
            "value": blast_label or "isolated",
            "points": blast_points,
            "detail": "Dependency count, shared-library status, and vulnerable dependency signals.",
            "explanation": "The dependency footprint increases how far a bad deploy could spread if this run goes wrong.",
        },
    ]
    breakdown_for_prompt = sorted(breakdown, key=lambda entry: entry["points"], reverse=True)

    payload = {
        "risk_score": score,
        "risk_band": risk_band,
        "auto_fix_below": auto_fix_below,
        "require_approval_above": require_approval_above,
        "environment": environment,
        "diff_lines": diff_lines,
        "file_types": file_types,
        "api_surface": api_surface,
        "commit_signal": commit_signal,
        "historical_failures": recent_failure_count,
        "last_deploy_caused_incident": last_deploy_caused_incident,
        "downstream_dependents": downstream_dependents,
        "is_shared_library": is_shared_library,
        "vulnerable_dependency": vulnerable_dependency,
        "diagnosis": diagnosis_payload,
        "changed_files": changed_files[:8],
        "score_breakdown": breakdown,
    }
    return payload, breakdown_for_prompt


async def classify_risk(
    *,
    workspace: Workspace,
    pipeline_run: PipelineRun,
    compare_details: dict[str, Any],
    diagnosis_report: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any], str, str]:
    payload, breakdown = await build_risk_payload(
        workspace=workspace,
        pipeline_run=pipeline_run,
        compare_details=compare_details,
        diagnosis_report=diagnosis_report,
    )

    try:
        response_text, provider, model = await call_with_fallback(
            primary_provider=settings.RISK_AGENT_PRIMARY_PROVIDER,
            primary_model=settings.RISK_AGENT_PRIMARY_MODEL,
            fallback_provider=settings.RISK_AGENT_FALLBACK_PROVIDER,
            fallback_model=settings.RISK_AGENT_FALLBACK_MODEL,
            system_prompt=RISK_SYSTEM_PROMPT,
            user_prompt=json.dumps(payload, separators=(",", ":")),
            temperature=0.1,
            max_tokens=500,
        )
        parsed = json.loads(response_text)
        return _sanitize_risk_report(payload, parsed, breakdown), payload, provider, model
    except Exception:
        return (
            _fallback_explanation(payload, breakdown),
            payload,
            "deterministic",
            "rules-only",
        )


def _default_compare_details(message: str) -> dict[str, Any]:
    return {
        "diff_text": message,
        "files": [],
        "changed_files": [],
        "total_changed_lines": 0,
    }


def _extract_compare_refs(pipeline_run: PipelineRun) -> tuple[str, str]:
    raw_event = pipeline_run.raw_event or {}
    workflow_run = raw_event.get("workflow_run") or {}

    base_sha = ""
    pull_requests = workflow_run.get("pull_requests") or []
    if pull_requests:
        base_sha = ((pull_requests[0].get("base") or {}).get("sha") or "").strip()

    if not base_sha:
        parents = ((workflow_run.get("head_commit") or {}).get("parents") or [])
        if parents:
            base_sha = (parents[0].get("sha") or "").strip()

    head_sha = (workflow_run.get("head_sha") or pipeline_run.commit_sha or "").strip()
    return base_sha, head_sha


async def fetch_compare_details_for_pipeline_run(pipeline_run: PipelineRun) -> dict[str, Any]:
    if not pipeline_run.installation_id or not pipeline_run.repository_full_name:
        return _default_compare_details("Git diff unavailable: missing repository context for backfill.")

    base_sha, head_sha = _extract_compare_refs(pipeline_run)
    try:
        return await fetch_compare_details(
            installation_id=pipeline_run.installation_id,
            repository_full_name=pipeline_run.repository_full_name,
            base_sha=base_sha,
            head_sha=head_sha,
        )
    except Exception as exc:
        return _default_compare_details(f"Git diff lookup failed during backfill: {exc}")


async def classify_and_store_risk_for_pipeline_run(
    *,
    workspace: Workspace,
    pipeline_run: PipelineRun,
) -> dict[str, Any]:
    diagnosis_report = pipeline_run.diagnosis_report_json or {
        "name": pipeline_run.workflow_name or "",
        "branch": pipeline_run.branch or "",
        "error_type": "Runtime Failure",
        "possible_causes": [pipeline_run.error_summary or "Inspect the failing step and recent diff"],
        "latest_working_change": "Backfill requested for a run created before risk classification was available.",
    }
    compare_details = await fetch_compare_details_for_pipeline_run(pipeline_run)
    risk_report, risk_inputs, provider, model = await classify_risk(
        workspace=workspace,
        pipeline_run=pipeline_run,
        compare_details=compare_details,
        diagnosis_report=diagnosis_report,
    )

    pipeline_run.risk_status = "completed"
    pipeline_run.risk_score = risk_report.get("risk_score")
    pipeline_run.risk_band = risk_report.get("risk_band")
    pipeline_run.risk_report_json = risk_report
    pipeline_run.risk_inputs_json = risk_inputs
    pipeline_run.risk_provider = provider
    pipeline_run.risk_model = model
    pipeline_run.risk_error = None
    pipeline_run.updated_at = datetime.now(timezone.utc)
    await pipeline_run.save()
    return risk_report
