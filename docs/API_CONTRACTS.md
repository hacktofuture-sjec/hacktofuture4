# API Contracts

## SSE Event Schema (Agent → Frontend)

```
Content-Type: text/event-stream
```

### Events

| Event Type | Schema |
|------------|--------|
| `reasoning_step` | `{step_id, agent_name, status, description, timestamp, payload}` |
| `tool_call` | `{tool_name, arguments, result_preview}` |
| `final_answer` | `{content, sources}` |
| `error` | `{message, step_id}` |

## MCP Tool Response Format

All tools return:

```json
{
  "success": boolean,
  "data": object | null,
  "error": string | null,
  "metadata": {
    "timestamp": "ISO-8601",
    "execution_time_ms": number
  }
}
```

## HTTP Endpoints

### Agent Service

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/query` | Returns SSE stream for voice query processing |
| `GET` | `/health` | Health check - returns `{status: "ok", service: "agent"|"jira"|"hubspot"}` |

### Backend (Django)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/queries/` | Create new query log |
| `GET` | `/api/v1/queries/` | List all queries |
| `GET` | `/api/v1/integrations/` | List integration configs |
| `POST` | `/api/v1/integrations/` | Create integration config |
| `GET` | `/health` | Health check |

### Jira MCP Server

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/v1/issues` | Create Jira issue |
| `GET` | `/api/v1/issues/{id}` | Get Jira issue details |
| `PUT` | `/api/v1/issues/{id}` | Update Jira issue |

### HubSpot MCP Server

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/v1/contacts` | Create HubSpot contact |
| `GET` | `/api/v1/contacts/{id}` | Get HubSpot contact |
| `POST` | `/api/v1/deals` | Create HubSpot deal |

## Authentication

All protected endpoints require API key in header:

```
Authorization: Bearer <api-key>
```
