"""API testing tool wrappers: arjun, x8, paramspider, ffuf."""

from __future__ import annotations

import os
import tempfile

from .. import parsers
from ..config import DEFAULT_WORDLISTS, TOOLS
from ..runner import run


def _binary(name: str) -> str:
    spec = TOOLS[name]
    resolved = spec.resolve()
    if not resolved:
        raise RuntimeError(f"{name} not installed (run install.sh)")
    return resolved


async def arjun_impl(
    target: str,
    method: str = "GET,POST",
    stable: bool = True,
) -> dict:
    # arjun writes JSON to a file; we read it back for parsing.
    with tempfile.NamedTemporaryFile(
        prefix="arjun-", suffix=".json", delete=False
    ) as tf:
        out_path = tf.name
    try:
        cmd = [_binary("arjun"), "-u", target, "-m", method, "-oJ", out_path]
        if stable:
            cmd.append("--stable")
        raw = await run(cmd, timeout=TOOLS["arjun"].default_timeout)
        try:
            with open(out_path, "rb") as fh:
                raw.stdout = fh.read()
        except FileNotFoundError:
            pass
        return parsers.parse_arjun(raw, target)
    finally:
        try:
            os.unlink(out_path)
        except OSError:
            pass


async def x8_impl(
    target: str,
    method: str = "GET",
    wordlist: str | None = None,
) -> dict:
    wl = wordlist or DEFAULT_WORDLISTS.get("x8", "/usr/share/wordlists/x8/params.txt")
    cmd = [
        _binary("x8"),
        "-u", target,
        "-X", method,
        "-w", wl,
        "--output-format", "json",
    ]
    raw = await run(cmd, timeout=TOOLS["x8"].default_timeout)
    return parsers.parse_x8(raw, target)


async def paramspider_impl(target: str, level: int = 2) -> dict:
    # The devanshbatham/paramspider (git) CLI only accepts `-d DOMAIN`
    # and writes to `results/<domain>.txt` in the current working dir.
    # Run it in a temp cwd so we can read back the file without polluting
    # the MCP server's working directory.
    import tempfile as _tf
    with _tf.TemporaryDirectory(prefix="ps-") as cwd:
        cmd = [_binary("paramspider"), "-d", target]
        raw = await run(cmd, timeout=TOOLS["paramspider"].default_timeout, cwd=cwd)
        # Try to read the results file it dropped.
        results_dir = os.path.join(cwd, "results")
        try:
            for fname in os.listdir(results_dir):
                with open(os.path.join(results_dir, fname), "rb") as fh:
                    raw.stdout = (raw.stdout or b"") + fh.read()
        except FileNotFoundError:
            pass
        return parsers.parse_paramspider(raw, target)


async def ffuf_impl(
    target: str,
    mode: str = "content",
    method: str = "GET",
    wordlist: str | None = None,
) -> dict:
    """mode: 'content' (FUZZ in URL) or 'parameter' (FUZZ as POST body)."""
    wl = wordlist or DEFAULT_WORDLISTS.get(
        "ffuf", "/usr/share/seclists/Discovery/Web-Content/common.txt"
    )
    # ffuf's json output goes to a file, not stdout. Use a temp file and
    # read it back into the RunResult so the parser sees the JSON document.
    with tempfile.NamedTemporaryFile(
        prefix="ffuf-", suffix=".json", delete=False
    ) as tf:
        out_path = tf.name
    try:
        if mode == "parameter":
            cmd = [
                _binary("ffuf"),
                "-u", target,
                "-X", method,
                "-d", "FUZZ=test",
                "-w", wl,
                "-mc", "200,204,301,302,307,401,403",
                "-of", "json", "-o", out_path,
                "-s",  # silent: no pretty TTY output to stderr
            ]
        else:
            url = target if "FUZZ" in target else target.rstrip("/") + "/FUZZ"
            cmd = [
                _binary("ffuf"),
                "-u", url,
                "-w", wl,
                "-of", "json", "-o", out_path,
                "-mc", "200,204,301,302,307,401,403",
                "-s",
            ]
        raw = await run(cmd, timeout=TOOLS["ffuf"].default_timeout)
        try:
            with open(out_path, "rb") as fh:
                raw.stdout = fh.read()
        except FileNotFoundError:
            pass
        return parsers.parse_ffuf(raw, target)
    finally:
        try:
            os.unlink(out_path)
        except OSError:
            pass
