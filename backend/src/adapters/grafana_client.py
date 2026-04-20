from __future__ import annotations

import os
from typing import Any
from urllib.parse import ParseResult, urlparse

import httpx


class GrafanaClientError(RuntimeError):
    pass


class GrafanaClient:
    def __init__(
        self,
        *,
        timeout_seconds: float = 15.0,
    ) -> None:
        self.timeout_seconds = timeout_seconds

    @classmethod
    def from_env(cls) -> "GrafanaClient":
        raw_timeout = os.getenv("GRAFANA_TIMEOUT_SECONDS", "15").strip()
        try:
            timeout_seconds = float(raw_timeout)
        except ValueError as exc:
            raise GrafanaClientError("GRAFANA_TIMEOUT_SECONDS must be a number") from exc

        if timeout_seconds <= 0:
            raise GrafanaClientError("GRAFANA_TIMEOUT_SECONDS must be greater than 0")

        return cls(timeout_seconds=timeout_seconds)

    def fetch_public_dashboard(self, *, public_dashboard_url: str) -> dict[str, Any]:
        parsed_url = self._parse_public_dashboard_url(public_dashboard_url)
        token = self._extract_dashboard_token(parsed_url)
        base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"

        api_url = f"{base_url}/api/public/dashboards/{token}"
        if parsed_url.query:
            api_url = f"{api_url}?{parsed_url.query}"

        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                response = client.get(api_url)
        except httpx.HTTPError as exc:
            raise GrafanaClientError(f"Grafana request failed: {exc}") from exc

        if response.status_code in {401, 403}:
            raise GrafanaClientError(
                "Grafana public dashboard fetch failed: authentication or permission error"
            )
        if response.status_code == 404:
            raise GrafanaClientError(f"Grafana public dashboard token '{token}' was not found")
        if response.status_code >= 500:
            raise GrafanaClientError("Grafana service error while fetching public dashboard")
        if response.status_code >= 400:
            raise GrafanaClientError(f"Grafana public dashboard fetch failed with status {response.status_code}")

        try:
            body = response.json()
        except ValueError as exc:
            raise GrafanaClientError("Grafana returned a non-JSON public dashboard payload") from exc

        if not isinstance(body, dict):
            raise GrafanaClientError("Grafana public dashboard payload is invalid")

        dashboard = body.get("dashboard")
        if not isinstance(dashboard, dict):
            raise GrafanaClientError("Grafana public dashboard response is missing dashboard data")

        meta = body.get("meta") if isinstance(body.get("meta"), dict) else {}
        panels = dashboard.get("panels") if isinstance(dashboard.get("panels"), list) else []

        return {
            "public_dashboard_token": token,
            "source_url": public_dashboard_url.strip(),
            "grafana_base_url": base_url,
            "title": str(dashboard.get("title", "Grafana Dashboard")),
            "uid": str(dashboard.get("uid", "")),
            "version": int(dashboard.get("version", 0) or 0),
            "timezone": str(dashboard.get("timezone", "")),
            "refresh": str(dashboard.get("refresh", "")),
            "time_range": {
                "from": str((dashboard.get("time") or {}).get("from", "")),
                "to": str((dashboard.get("time") or {}).get("to", "")),
            },
            "meta": {
                "slug": str(meta.get("slug", "")),
                "created": str(meta.get("created", "")),
                "updated": str(meta.get("updated", "")),
                "public_dashboard_enabled": bool(meta.get("publicDashboardEnabled", False)),
            },
            "panel_count": len(panels),
            "panels": [self._normalize_panel(panel) for panel in panels if isinstance(panel, dict)],
        }

    def _parse_public_dashboard_url(self, public_dashboard_url: str) -> ParseResult:
        normalized = public_dashboard_url.strip()
        if not normalized:
            raise GrafanaClientError("public_dashboard_url is required")

        parsed = urlparse(normalized)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise GrafanaClientError(
                "public_dashboard_url must be an absolute URL like https://example.grafana.net/public-dashboards/<token>"
            )

        return parsed

    def _extract_dashboard_token(self, parsed_url: ParseResult) -> str:
        path_parts = [part for part in parsed_url.path.split("/") if part]
        if "public-dashboards" not in path_parts:
            raise GrafanaClientError(
                "public_dashboard_url must contain '/public-dashboards/<token>'"
            )

        token_index = path_parts.index("public-dashboards") + 1
        if token_index >= len(path_parts):
            raise GrafanaClientError("public_dashboard_url is missing dashboard token")

        token = path_parts[token_index].strip()
        if not token:
            raise GrafanaClientError("public_dashboard_url is missing dashboard token")

        return token

    def _normalize_panel(self, panel: dict[str, Any]) -> dict[str, Any]:
        datasource = panel.get("datasource")
        datasource_type = ""
        datasource_uid = ""

        if isinstance(datasource, dict):
            datasource_type = str(datasource.get("type", ""))
            datasource_uid = str(datasource.get("uid", ""))
        elif isinstance(datasource, str):
            datasource_type = datasource

        raw_targets = panel.get("targets") if isinstance(panel.get("targets"), list) else []
        normalized_targets: list[dict[str, Any]] = []
        for raw_target in raw_targets:
            if not isinstance(raw_target, dict):
                continue

            target_datasource = raw_target.get("datasource")
            target_datasource_type = ""
            target_datasource_uid = ""
            if isinstance(target_datasource, dict):
                target_datasource_type = str(target_datasource.get("type", ""))
                target_datasource_uid = str(target_datasource.get("uid", ""))

            query = (
                raw_target.get("expr")
                or raw_target.get("query")
                or raw_target.get("rawSql")
                or raw_target.get("statement")
                or ""
            )

            normalized_targets.append(
                {
                    "ref_id": str(raw_target.get("refId", "")),
                    "query": str(query),
                    "editor_mode": str(raw_target.get("editorMode", "")),
                    "datasource_type": target_datasource_type,
                    "datasource_uid": target_datasource_uid,
                    "raw": raw_target,
                }
            )

        return {
            "id": panel.get("id"),
            "title": str(panel.get("title", "")),
            "type": str(panel.get("type", "")),
            "datasource_type": datasource_type,
            "datasource_uid": datasource_uid,
            "grid_pos": panel.get("gridPos", {}),
            "transparent": bool(panel.get("transparent", False)),
            "plugin_version": str(panel.get("pluginVersion", "")),
            "targets": normalized_targets,
            "options": panel.get("options", {}),
            "field_config": panel.get("fieldConfig", {}),
        }
