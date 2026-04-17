#!/usr/bin/env python3
"""Exit 1 if any dev port is already bound (prevents make dev half-starting)."""
from __future__ import annotations

import socket
import sys

PORTS = (8000, 8001, 5173)


def main() -> int:
    for port in PORTS:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(("0.0.0.0", port))
        except OSError as e:
            print(
                f"ERROR: Port {port} is already in use ({e}).\n"
                f"       Stop runserver / uvicorn / vite (or anything on :{port}) "
                "before running `make dev`.",
                file=sys.stderr,
            )
            return 1
        finally:
            s.close()
    print("Ports 8000, 8001, 5173 are free.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
