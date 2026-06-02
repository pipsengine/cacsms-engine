"""EA deployment and update operations for Windows machine agents."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8192), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_manifest(repo_root: Path) -> dict[str, Any]:
    manifest_path = repo_root / "mt5" / "deploy-manifest.json"
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def bridge_source(data_path: Path) -> Path:
    return data_path / "MQL5" / "Experts" / "CACSMS" / "CACSMS_Engine_Bridge.mq5"


def bridge_binary(data_path: Path) -> Path:
    return data_path / "MQL5" / "Experts" / "CACSMS" / "CACSMS_Engine_Bridge.ex5"


def navigator_candidates(data_path: Path) -> list[Path]:
    return [
        bridge_binary(data_path),
        bridge_source(data_path),
        data_path / "MQL5" / "Experts" / "CACSMS_Engine_Bridge.ex5",
        data_path / "MQL5" / "Experts" / "CACSMS_Engine_Bridge.mq5",
    ]


def verify_compiled_bridge(data_path: Path) -> bool:
    source = bridge_source(data_path)
    binary = bridge_binary(data_path)
    return source.exists() and binary.exists() and binary.stat().st_mtime >= source.stat().st_mtime


def find_metaeditor() -> Path | None:
    roots = [Path(os.environ.get("ProgramFiles", r"C:\Program Files"))]
    program_files_x86 = os.environ.get("ProgramFiles(x86)")
    if program_files_x86:
        roots.append(Path(program_files_x86))
    for root in roots:
        for pattern in ("MetaTrader*/*MetaEditor64.exe", "MetaTrader*/MetaEditor64.exe"):
            matches = sorted(root.glob(pattern))
            if matches:
                return matches[0]
    return None


def compile_bridge(data_path: Path) -> dict[str, Any]:
    source = bridge_source(data_path)
    editor = find_metaeditor()
    if not source.exists():
        return {"ok": False, "error": f"Missing bridge source: {source}"}
    if not editor:
        return {"ok": False, "error": "MetaEditor64.exe not found"}
    log_path = source.with_name(f"{source.stem}.compile-{time.time_ns()}.log")
    binary = bridge_binary(data_path)
    try:
        result = subprocess.run(
            [str(editor), f'/compile:"{source}"', f'/log:"{log_path}"'],
            check=False,
            capture_output=True,
            text=True,
            timeout=60,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        return {"ok": False, "error": f"MetaEditor compilation failed: {error}"}
    compiler_log = log_path.read_text(encoding="utf-16", errors="ignore") if log_path.exists() else ""
    compiled = verify_compiled_bridge(data_path) and "Result: 0 errors, 0 warnings" in compiler_log
    return {
        "ok": compiled,
        "error": None if compiled else f"Compiled bridge binary was not refreshed: {bridge_binary(data_path)}",
        "editor": str(editor),
        "exitCode": result.returncode,
        "logPath": str(log_path),
    }


def backup_file(source: Path, backup_root: Path) -> dict[str, Any] | None:
    if not source.exists():
        return None
    backup_root.mkdir(parents=True, exist_ok=True)
    backup_path = backup_root / source.name
    shutil.copy2(source, backup_path)
    return {"original": str(source), "backup": str(backup_path), "checksum": sha256_file(source)}


def deploy_files(repo_root: Path, data_path: Path, action: str, rollback_snapshots: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    manifest = load_manifest(repo_root)
    mt5_root = repo_root / "mt5"
    data = Path(data_path)
    backup_root = data / ".cacsms-backup" / "agent"
    backup_root.mkdir(parents=True, exist_ok=True)

    deployed_files: list[dict[str, Any]] = []
    snapshots: list[dict[str, Any]] = []
    errors: list[str] = []

    if action == "rollback":
        for snapshot in rollback_snapshots or []:
            original = Path(snapshot["original"])
            backup = Path(snapshot["backup"])
            if backup.exists():
                original.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(backup, original)
        return {
            "ok": True,
            "errors": [],
            "deployedFiles": [],
            "snapshots": rollback_snapshots or [],
            "navigatorVerified": verify_compiled_bridge(data),
            "detectedVersion": manifest.get("version"),
        }

    for entry in manifest.get("files", []):
        source = mt5_root / Path(entry["source"])
        target = data / Path(entry["target"])
        if not source.exists():
            errors.append(f"Missing source file: {entry['source']}")
            continue
        source_checksum = sha256_file(source)
        if action != "verify" and target.exists():
            snapshot = backup_file(target, backup_root)
            if snapshot:
                snapshots.append(snapshot)
        if action == "verify":
            target_checksum = sha256_file(target) if target.exists() else None
            status = "VERIFIED" if target_checksum == source_checksum else "MISMATCH"
            deployed_files.append(
                {
                    "relativePath": entry["target"],
                    "targetPath": str(target),
                    "sourceChecksum": source_checksum,
                    "targetChecksum": target_checksum,
                    "status": status,
                }
            )
            if status != "VERIFIED":
                errors.append(f"Checksum mismatch: {entry['target']}")
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        target_checksum = sha256_file(target)
        status = "DEPLOYED" if target_checksum == source_checksum else "FAILED"
        deployed_files.append(
            {
                "relativePath": entry["target"],
                "targetPath": str(target),
                "sourceChecksum": source_checksum,
                "targetChecksum": target_checksum,
                "status": status,
            }
        )
        if status != "DEPLOYED":
            errors.append(f"Post-copy checksum mismatch: {entry['target']}")

    compilation = None
    if action in {"deploy", "update"} and not errors:
        compilation = compile_bridge(data)
        if not compilation["ok"]:
            errors.append(compilation["error"])

    return {
        "ok": not errors,
        "errors": errors,
        "deployedFiles": deployed_files,
        "snapshots": snapshots,
        "navigatorVerified": verify_compiled_bridge(data),
        "compilation": compilation,
        "detectedVersion": manifest.get("version"),
    }
