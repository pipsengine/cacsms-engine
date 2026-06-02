"""CLI entrypoint used by CACSMS Engine and the Windows machine agent."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "apps" / "machine-agent"))

from agent.deployment_manager import deploy_files  # noqa: E402
from agent.terminal_discovery import discover_mt5_terminals  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="CACSMS MT5 EA deployment CLI")
    parser.add_argument("--action", choices=["deploy", "update", "verify", "rollback", "discover"], required=True)
    parser.add_argument("--data-path", default="")
    parser.add_argument("--repo-root", default=str(ROOT))
    parser.add_argument("--deployment-id", default="")
    args = parser.parse_args()

    repo_root = Path(args.repo_root)
    if args.action == "discover":
        print(json.dumps({"terminals": discover_mt5_terminals()}))
        return 0

    if not args.data_path:
        discovered = discover_mt5_terminals()
        if not discovered:
            print(json.dumps({"ok": False, "errors": ["mt5_terminal_paths_not_found"]}))
            return 1
        data_path = discovered[0]["dataPath"]
    else:
        data_path = args.data_path

    result = deploy_files(repo_root, Path(data_path), args.action)
    print(json.dumps(result))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
