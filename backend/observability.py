"""
OpenTelemetry bootstrap for exporting traces to SigNoz via OTLP.
"""
import logging
from typing import Dict

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.logging import LoggingInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.sdk.resources import Resource, SERVICE_NAME
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from backend.config import settings

logger = logging.getLogger(__name__)
_initialized = False


def _parse_resource_attributes(raw: str) -> Dict[str, str]:
    attrs: Dict[str, str] = {}
    if not raw:
        return attrs

    for item in raw.split(","):
        pair = item.strip()
        if not pair or "=" not in pair:
            continue
        key, value = pair.split("=", 1)
        key = key.strip()
        value = value.strip()
        if key:
            attrs[key] = value
    return attrs


def _normalize_otlp_endpoint(endpoint: str) -> str:
    """Normalize endpoint for OTLP HTTP trace exporter.

    Expected form for SigNoz local collector is:
    http://127.0.0.1:4318/v1/traces
    """
    if not endpoint:
        return "http://127.0.0.1:4318/v1/traces"

    normalized = endpoint.strip().rstrip("/")

    if not normalized.startswith("http://") and not normalized.startswith("https://"):
        normalized = f"http://{normalized}"

    if not normalized.endswith("/v1/traces"):
        normalized = f"{normalized}/v1/traces"

    return normalized


def setup_observability(app) -> None:
    """Configure tracing and common instrumentations for FastAPI runtime."""
    global _initialized

    if _initialized:
        return

    if not settings.OTEL_ENABLED:
        logger.info("[Observability] OTEL disabled")
        _initialized = True
        return

    try:
        attrs = {
            SERVICE_NAME: settings.OTEL_SERVICE_NAME,
            "service.version": settings.APP_VERSION,
        }
        attrs.update(_parse_resource_attributes(settings.OTEL_RESOURCE_ATTRIBUTES))

        resource = Resource.create(attrs)
        tracer_provider = TracerProvider(resource=resource)

        exporter = OTLPSpanExporter(
            endpoint=_normalize_otlp_endpoint(settings.OTEL_EXPORTER_OTLP_ENDPOINT),
        )
        tracer_provider.add_span_processor(BatchSpanProcessor(exporter))
        trace.set_tracer_provider(tracer_provider)

        FastAPIInstrumentor.instrument_app(app, tracer_provider=tracer_provider)
        HTTPXClientInstrumentor().instrument(tracer_provider=tracer_provider)
        RedisInstrumentor().instrument(tracer_provider=tracer_provider)
        LoggingInstrumentor().instrument(set_logging_format=False)

        logger.info(
            "[Observability] OTLP exporter configured for %s",
            settings.OTEL_EXPORTER_OTLP_ENDPOINT,
        )
        _initialized = True
    except Exception as exc:
        logger.warning("[Observability] Failed to initialize tracing: %s", exc)
        _initialized = True
