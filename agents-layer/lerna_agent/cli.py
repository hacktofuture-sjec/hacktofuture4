"""CLI for manual testing: `python -m lerna_agent.cli "your question"` (PYTHONPATH must include agents-layer)."""

from __future__ import annotations

import argparse
import sys
from typing import Sequence

from .agent import LernaAgent


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the Lerna OpenAI tool agent once.")
    parser.add_argument("message", nargs="?", default=None, help="User message")
    parser.add_argument(
        "-m",
        "--model",
        default=None,
        help="Override model (default: env LERNA_AGENT_MODEL or gpt-4o-mini)",
    )
    args = parser.parse_args(argv)
    text = args.message
    if not text:
        text = sys.stdin.read().strip()
    if not text:
        parser.error("Provide a message argument or pipe stdin")
    agent = LernaAgent(model=args.model)
    print(agent.run(text))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
