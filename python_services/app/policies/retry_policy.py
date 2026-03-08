"""Retry helpers for provider access."""

from __future__ import annotations

from dataclasses import dataclass
import random
import time
from typing import Callable, TypeVar

_T = TypeVar("_T")


@dataclass(frozen=True)
class RetryPolicy:
    max_attempts: int = 3
    base_delay_ms: int = 200
    multiplier: float = 4.0
    max_delay_ms: int = 2000
    jitter_ratio: float = 0.2


def retry_sync(
    operation: Callable[[], _T],
    policy: RetryPolicy,
    should_retry: Callable[[Exception], bool] | None = None,
) -> _T:
    last_error: Exception | None = None

    for attempt in range(1, policy.max_attempts + 1):
        try:
            return operation()
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if should_retry is not None and not should_retry(exc):
                raise

            if attempt >= policy.max_attempts:
                raise

            delay_ms = min(
                int(policy.base_delay_ms * (policy.multiplier ** (attempt - 1))),
                policy.max_delay_ms,
            )
            jitter = delay_ms * policy.jitter_ratio
            sleep_ms = max(0, delay_ms + random.uniform(-jitter, jitter))
            time.sleep(sleep_ms / 1000)

    if last_error is not None:
        raise last_error

    raise RuntimeError("retry_sync ended unexpectedly")

