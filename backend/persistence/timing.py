"""Low-overhead diagnostic timings without SQL parameters or connection details."""
import logging
from contextlib import contextmanager
from contextvars import ContextVar
from time import perf_counter


request_id = ContextVar('performance_request_id', default='background')
persistence_metrics = ContextVar('performance_persistence_metrics', default=None)
logger = logging.getLogger('bhumi.performance')


def record(stage, started, **counts):
    details = ''.join(f' {key}={value}' for key, value in counts.items())
    logger.warning('perf request_id=%s stage=%s duration_ms=%.2f%s',
                   request_id.get(), stage, (perf_counter() - started) * 1000, details)


def event(stage, **counts):
    details = ''.join(f' {key}={value}' for key, value in counts.items())
    logger.warning('perf request_id=%s stage=%s%s', request_id.get(), stage, details)


def duration(stage, seconds, **counts):
    details = ''.join(f' {key}={value}' for key, value in counts.items())
    logger.warning('perf request_id=%s stage=%s duration_ms=%.2f%s',
                   request_id.get(), stage, seconds * 1000, details)


class DatabaseCalls:
    """Count SQL statements, including failed attempts, without logging SQL/values."""
    def __init__(self):
        self.count = 0
        self.seconds = 0.0

    def execute(self, connection, statement, parameters):
        started = perf_counter()
        try:
            return connection.execute(statement, parameters)
        finally:
            self.count += 1
            self.seconds += perf_counter() - started

    def fetchall(self, cursor):
        started = perf_counter()
        try:
            return cursor.fetchall()
        finally:
            self.seconds += perf_counter() - started

    def report(self, stage):
        duration(stage, self.seconds, persistence_operation_count=self.count,
                 average_db_call_ms=round(self.seconds * 1000 / self.count, 3) if self.count else 0)

    def accumulate(self):
        metrics = persistence_metrics.get()
        if metrics is not None:
            metrics['persistence_operation_count'] += self.count
            metrics['persistence_db_seconds'] += self.seconds


@contextmanager
def timed(stage):
    started = perf_counter()
    try:
        yield
    finally:
        record(stage, started)
