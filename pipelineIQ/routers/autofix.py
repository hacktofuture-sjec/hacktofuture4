from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
from jose import JWTError

from models.pipeline_run import PipelineRun
from services.autofix_service import (
    get_autofix_execution_by_token,
    handle_report_feedback,
)

router = APIRouter(prefix="/api/autofix", tags=["autofix"])


class AutoFixDecisionBody(BaseModel):
    decision: str
    note: str | None = None


@router.get("/report")
async def get_autofix_report(token: str):
    try:
        execution = await get_autofix_execution_by_token(token)
    except JWTError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    pipeline_run = await PipelineRun.get(execution.pipeline_run_id)
    return {
        "execution": {
            "id": str(execution.id),
            "mode": execution.mode,
            "policy_action": execution.policy_action,
            "execution_status": execution.execution_status,
            "pr_number": execution.pr_number,
            "pr_url": execution.pr_url,
            "fix_branch": execution.fix_branch,
            "report_feedback_status": execution.report_feedback_status,
            "report_feedback_note": execution.report_feedback_note,
            "reviewer_username": execution.reviewer_username,
            "reviewer_github_id": execution.reviewer_github_id,
            "target_branch": execution.target_branch,
            "loop_blocked_reason": execution.loop_blocked_reason,
            "report": execution.report_json,
            "proposed_fix": execution.proposed_fix_json,
            "created_at": execution.created_at.isoformat(),
            "updated_at": execution.updated_at.isoformat(),
        },
        "pipeline_run": {
            "workflow_name": pipeline_run.workflow_name if pipeline_run else None,
            "branch": pipeline_run.branch if pipeline_run else None,
            "commit_sha": pipeline_run.commit_sha if pipeline_run else None,
            "diagnosis": pipeline_run.diagnosis_report_json if pipeline_run else {},
            "risk": pipeline_run.risk_report_json if pipeline_run else {},
        },
    }


@router.post("/report/decision")
async def submit_autofix_report_decision(token: str, body: AutoFixDecisionBody):
    try:
        result = await handle_report_feedback(
            token=token,
            decision=body.decision,
            note=body.note,
        )
        return result
    except JWTError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 403:
            raise HTTPException(status_code=403, detail="GitHub App is forbidden. Ensure 'Contents: Write' and 'Pull Requests: Write' permissions are granted in Developer Settings.")
        raise HTTPException(status_code=500, detail=f"GitHub API Error: {exc.response.text}")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Internal Error: {str(exc)}")
