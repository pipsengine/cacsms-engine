"""EA deployment and update operations for Windows machine agents."""

from __future__ import annotations

import hashlib
import json
import shutil
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


def navigator_candidates(data_path: Path) -> list[Path]:
    return [
        data_path / "MQL5" / "Experts" / "CACSMS" / "CACSMS_Engine_Bridge.ex5",
        data_path / "MQL5" / "Experts" / "CACSMS" / "CACSMS_Engine_Bridge.mq5",
        data_path / "MQL5" / "Experts" / "CACSMS_Engine_Bridge.ex5",
        data_path / "MQL5" / "Experts" / "CACSMS_Engine_Bridge.mq5",
    ]


def verify_navigator(data_path: Path) -> bool:
    return any(path.exists() for path in navigator_candidates(data_path))


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
            "navigatorVerified": verify_navigator(data),
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

    return {
        "ok": not errors,
        "errors": errors,
        "deployedFiles": deployed_files,
        "snapshots": snapshots,
        "navigatorVerified": verify_navigator(data),
        "detectedVersion": manifest.get("version"),
    }
