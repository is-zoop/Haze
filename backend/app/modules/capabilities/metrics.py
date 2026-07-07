from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.capabilities.models import Capability
from app.modules.marketplace.models import CapabilityDownloadLog
from app.modules.mcp_runtime.models import McpCallLog


def capability_call_counts(
    db: Session,
    capabilities: Iterable[Capability],
) -> dict[int, int]:
    """Return lifetime usage counts using the metric appropriate for each capability type."""
    items = list(capabilities)
    if not items:
        return {}

    download_ids: list[int] = []
    http_mcp_ids: list[int] = []
    for capability in items:
        config = (capability.extension_json or {}).get("config") or {}
        transport = str(config.get("transport") or "HTTP").upper()
        if capability.type == "skill" or transport == "STDIO":
            download_ids.append(capability.id)
        else:
            http_mcp_ids.append(capability.id)

    counts = {capability.id: 0 for capability in items}
    if download_ids:
        counts.update({
            capability_id: int(total)
            for capability_id, total in db.execute(
                select(CapabilityDownloadLog.capability_id, func.count(CapabilityDownloadLog.id))
                .where(CapabilityDownloadLog.capability_id.in_(download_ids))
                .group_by(CapabilityDownloadLog.capability_id)
            ).all()
        })
    if http_mcp_ids:
        counts.update({
            capability_id: int(total)
            for capability_id, total in db.execute(
                select(McpCallLog.capability_id, func.count(McpCallLog.id))
                .where(
                    McpCallLog.capability_id.in_(http_mcp_ids),
                    McpCallLog.success.is_(True),
                    McpCallLog.method == "tools/call",
                )
                .group_by(McpCallLog.capability_id)
            ).all()
        })
    return counts
