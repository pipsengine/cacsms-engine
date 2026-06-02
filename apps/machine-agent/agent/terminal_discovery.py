"""MT5 terminal discovery for Windows machine agents."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


def discover_mt5_terminals() -> list[dict[str, Any]]:
    appdata = os.environ.get("APPDATA")
    if not appdata:
        return []

    terminal_root = Path(appdata) / "MetaQuotes" / "Terminal"
    if not terminal_root.exists():
        return []

    discovered: list[dict[str, Any]] = []
    for entry in terminal_root.iterdir():
        if not entry.is_dir():
            continue
        mql5_path = entry / "MQL5"
        if not mql5_path.exists():
            continue
        origin = ""
        origin_path = entry / "origin.txt"
        if origin_path.exists():
            origin = origin_path.read_text(encoding="utf-8", errors="ignore").strip()
        discovered.append(
            {
                "terminalInstallId": entry.name,
                "dataPath": str(entry),
                "expertsPath": str(mql5_path / "Experts"),
                "includePath": str(mql5_path / "Include"),
                "scriptsPath": str(mql5_path / "Scripts"),
                "presetsPath": str(mql5_path / "Presets"),
                "templatesPath": str(entry / "Profiles" / "Templates"),
                "origin": origin,
            }
        )
    return discovered


def main() -> None:
    print(json.dumps({"terminals": discover_mt5_terminals()}, indent=2))


if __name__ == "__main__":
    main()
