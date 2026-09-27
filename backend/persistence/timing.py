"""Low-overhead diagnostic timings without SQL parameters or connection details."""
import logging
from contextlib import contextmanager
from contextvars import ContextVar
from time import perf_counter


request_id = ContextVar('performance_request_id', default='background')
logger = logging.getLogger('bhumi.performance')


def record(stage, started, **counts):
    details = ''.join(f' {key}={value}' for key, value in counts.items())
    logger.warning('perf request_id=%s stage=%s duration_ms=%.2f%s',
                   request_id.get(), stage, (perf_counter() - started) * 1000, details)


@contextmanager
def timed(stage):
    started = perf_counter()
    try:
        yield
    finally:
        record(stage, started)
