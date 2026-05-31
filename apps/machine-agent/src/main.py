"""Windows VPS machine-agent service boundary."""

from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass(frozen=True)
class Heartbeat:
    machine_key: str
    agent_key: str
    observed_at: str


def create_heartbeat(machine_key: str, agent_key: str) -> Heartbeat:
    return Heartbeat(
        machine_key=machine_key,
        agent_key=agent_key,
        observed_at=datetime.now(timezone.utc).isoformat(),
    )
