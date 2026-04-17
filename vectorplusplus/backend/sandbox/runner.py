"""
Sandbox Runner — safely run generated code inside a Docker container
before it touches the real repository.
"""
import subprocess
import os
import tempfile
import json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

SANDBOX_DOCKERFILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "..", "docker", "sandbox.dockerfile"
)


def run_in_sandbox(
    repo_name: str,
    patches: list[dict],
    test_file: dict,
    timeout: int = 120,
) -> dict:
    """
    Apply patches and run tests inside a Docker sandbox.

    Args:
        repo_name: GitHub repo path (e.g. 'owner/repo')
        patches: List of code patches from the Coder agent
        test_file: Test file dict from the Tester agent
        timeout: Max seconds to wait for Docker run

    Returns:
        Dict with success bool, stdout, stderr
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)

        # Write patched files to temp directory
        for patch in patches:
            path = patch.get("file_path", "")
            if not path:
                continue
            full_path = tmpdir / path.lstrip("/")
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_text(patch.get("new_code", ""), encoding="utf-8")

        # Write test file
        if test_file and test_file.get("test_file_path"):
            test_path = tmpdir / test_file["test_file_path"].lstrip("/")
            test_path.parent.mkdir(parents=True, exist_ok=True)
            test_path.write_text(test_file.get("test_code", ""), encoding="utf-8")

        # Write a simple run script
        run_script = tmpdir / "run_tests.sh"
        run_cmd = test_file.get("run_command", "pytest . -v --tb=short") if test_file else "pytest . -v"
        run_script.write_text(f"#!/bin/sh\n{run_cmd}\n")
        run_script.chmod(0o755)

        # Build Docker image from sandbox dockerfile
        image_tag = f"vectorplusplus-sandbox:latest"
        try:
            build_result = subprocess.run(
                ["docker", "build", "-f", SANDBOX_DOCKERFILE, "-t", image_tag, str(tmpdir)],
                capture_output=True,
                text=True,
                timeout=60,
            )
            if build_result.returncode != 0:
                print(f"[Sandbox] Docker build failed: {build_result.stderr[:500]}")
                # Fall back to local execution
                return _run_locally(tmpdir, run_cmd, timeout)
        except (subprocess.TimeoutExpired, FileNotFoundError):
            print("[Sandbox] Docker not available, running tests locally")
            return _run_locally(tmpdir, run_cmd, timeout)

        # Run tests in container
        try:
            run_result = subprocess.run(
                [
                    "docker", "run", "--rm",
                    "--network", "none",  # No network access
                    "--memory", "256m",
                    "--cpus", "0.5",
                    "-v", f"{tmpdir}:/workspace",
                    "-w", "/workspace",
                    image_tag,
                    "/bin/sh", "run_tests.sh",
                ],
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            return {
                "success": run_result.returncode == 0,
                "stdout": run_result.stdout[:2000],
                "stderr": run_result.stderr[:1000],
                "exit_code": run_result.returncode,
            }
        except subprocess.TimeoutExpired:
            return {"success": False, "stdout": "", "stderr": "Sandbox timed out", "exit_code": -1}


def _run_locally(tmpdir: Path, run_cmd: str, timeout: int) -> dict:
    """Fallback: run tests locally (less safe but works without Docker)."""
    try:
        result = subprocess.run(
            run_cmd.split(),
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(tmpdir),
        )
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout[:2000],
            "stderr": result.stderr[:1000],
            "exit_code": result.returncode,
        }
    except Exception as e:
        return {"success": False, "stdout": "", "stderr": str(e), "exit_code": -1}
