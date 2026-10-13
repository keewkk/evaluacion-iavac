"""Policy and metadata for a resolved delivery PR; no effort estimates."""
from __future__ import annotations

from typing import Any


def resolution_event(event_name: str, event: dict[str, Any], repo: str) -> bool:
    if event_name == "workflow_dispatch":
        return True
    pr = event.get("pull_request") or {}
    return (event_name == "pull_request" and event.get("action") == "closed" and pr.get("state") == "closed"
            and (pr.get("base") or {}).get("ref") == "main" and (pr.get("head") or {}).get("ref") == "desa"
            and ((pr.get("head") or {}).get("repo") or {}).get("full_name") == repo)


def capture_context(event_name: str, event: dict[str, Any], report: dict[str, Any]) -> dict[str, Any]:
    event_pr = event.get("pull_request") or {}
    current = report.get("pr") or {}
    resolved = event_name == "pull_request" and event.get("action") == "closed"
    kind = "integrado" if resolved and event_pr.get("merged") else "cerrado sin integrar" if resolved else "recaptura manual" if event_name == "workflow_dispatch" else "captura local"
    return {"kind": kind, "event_name": event_name or "local", "resolved_at": event_pr.get("merged_at") or event_pr.get("closed_at"),
            "event_head_sha": (event_pr.get("head") or {}).get("sha"),
            "head_matches_event": (event_pr.get("head") or {}).get("sha") == current.get("head_sha") if resolved else None,
            "current_state": current.get("state"), "merged_at": current.get("merged_at")}
