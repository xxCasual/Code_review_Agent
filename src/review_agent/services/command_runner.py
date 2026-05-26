import logging
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

from review_agent.observability import get_logger, log_event

logger = get_logger(__name__)


@dataclass(frozen=True)
class CommandResult:
    command: list[str]
    returncode: int
    stdout: str
    stderr: str

    @property
    def success(self) -> bool:
        return self.returncode == 0


class CommandRunner:
    def run(self, command: list[str], cwd: str | Path | None = None, timeout: int = 30) -> CommandResult:
        started = time.perf_counter()
        command_text = " ".join(command)
        log_event(
            logger,
            logging.INFO,
            "command.start",
            "Command started",
            stage="command",
            command=command_text,
        )
        try:
            completed = subprocess.run(
                command,
                cwd=Path(cwd) if cwd else None,
                capture_output=True,
                text=True,
                timeout=timeout,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            duration_ms = round((time.perf_counter() - started) * 1000, 2)
            log_event(
                logger,
                logging.ERROR,
                "command.failure",
                "Command timed out",
                stage="command",
                duration_ms=duration_ms,
                error_code="tool.timeout",
                command=command_text,
            )
            return CommandResult(
                command=command,
                returncode=-1,
                stdout=(exc.stdout or "") if isinstance(exc.stdout, str) else "",
                stderr=f"Command timed out after {timeout}s",
            )
        except OSError as exc:
            duration_ms = round((time.perf_counter() - started) * 1000, 2)
            log_event(
                logger,
                logging.ERROR,
                "command.failure",
                "Command execution failed",
                stage="command",
                duration_ms=duration_ms,
                error_code="tool.execution_failed",
                command=command_text,
                exception_type=type(exc).__name__,
            )
            return CommandResult(
                command=command,
                returncode=-1,
                stdout="",
                stderr=f"{type(exc).__name__}: {exc}",
            )
        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        log_event(
            logger,
            logging.INFO if completed.returncode == 0 else logging.ERROR,
            "command.success" if completed.returncode == 0 else "command.failure",
            "Command finished",
            stage="command",
            duration_ms=duration_ms,
            command=command_text,
            returncode=completed.returncode,
        )
        return CommandResult(command, completed.returncode, completed.stdout, completed.stderr)
