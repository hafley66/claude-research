---
name: ai-coding-tool-data
description: Data sources, formats, and access patterns for AI coding tools (Claude Code, OpenCode) -- JSONL transcripts, SQLite databases, OTel telemetry, status line scripts
trigger: ai coding tool data, claude code metrics, opencode data, coding tool telemetry, hud data source, claude code jsonl, claude code otel, opencode sqlite
dependencies: []
---

# AI Coding Tool Data Sources

Data interfaces for building external tooling (HUDs, dashboards, analyzers) on top of AI coding tools.

## Claude Code

### Data Interfaces (ranked by HUD suitability)

#### 1. Status Line Script (best for real-time HUD)

Config in `~/.claude/settings.json`:
```json
{ "statusLine": { "type": "command", "command": "path/to/script.sh" } }
```

Receives JSON on stdin after every assistant message:

| Field | Type | Description |
|---|---|---|
| `model.id` | string | e.g. `claude-opus-4-6` |
| `model.display_name` | string | e.g. `Claude Opus 4.6` |
| `cost.total_cost_usd` | float | Session cumulative cost |
| `cost.total_duration_ms` | int | Wall clock time |
| `cost.total_api_duration_ms` | int | API wait time |
| `cost.total_lines_added` | int | Code lines added |
| `cost.total_lines_removed` | int | Code lines removed |
| `context_window.total_input_tokens` | int | Cumulative input tokens |
| `context_window.total_output_tokens` | int | Cumulative output tokens |
| `context_window.context_window_size` | int | Max context (200k or 1M) |
| `context_window.used_percentage` | float | Context fill % |
| `context_window.current_usage.input_tokens` | int | Last call input |
| `context_window.current_usage.output_tokens` | int | Last call output |
| `context_window.current_usage.cache_creation_input_tokens` | int | Last call cache write |
| `context_window.current_usage.cache_read_input_tokens` | int | Last call cache read |
| `session_id` | string | UUID |
| `transcript_path` | string | Path to session JSONL |
| `version` | string | Claude Code version |

#### 2. JSONL Transcripts (per-session history)

Path: `~/.claude/projects/<project-path-dashes>/<session-uuid>.jsonl`

Each line is a JSON object with `type` field:

**`assistant` messages** contain `.message.usage`:
```json
{
  "input_tokens": 1,
  "cache_creation_input_tokens": 1659,
  "cache_read_input_tokens": 22055,
  "output_tokens": 258,
  "server_tool_use": { "web_search_requests": 0, "web_fetch_requests": 0 },
  "service_tier": "standard"
}
```

Model at `.message.model`. Stop reason at `.message.stop_reason`.

**Cost is NOT in JSONL** -- must be computed from token counts and known pricing.

Other message types: `user` (with `sessionId`, `version`, `gitBranch`, `cwd`), `progress` (tool streaming), `file-history-snapshot`.

#### 3. Stats Cache (aggregated)

Path: `~/.claude/stats-cache.json`

Contains:
- `dailyActivity[]`: `{ date, messageCount, sessionCount, toolCallCount }`
- `dailyModelTokens[]`: `{ date, tokensByModel: { "model": outputTokenCount } }`
- `modelUsage`: `{ "model": { inputTokens, outputTokens, cacheReadInputTokens, cacheCreationInputTokens, costUSD } }`
- `totalSessions`, `totalMessages`, `longestSession`, `firstSessionDate`, `hourCounts`

#### 4. OTel Telemetry (richest, opt-in)

Enable: `export CLAUDE_CODE_ENABLE_TELEMETRY=1`

Key env vars:
- `OTEL_METRICS_EXPORTER`: `otlp`, `prometheus`, `console`
- `OTEL_LOGS_EXPORTER`: `otlp`, `console`
- `OTEL_EXPORTER_OTLP_ENDPOINT`: e.g. `http://localhost:4317`
- `OTEL_METRIC_EXPORT_INTERVAL`: ms (default 60000)
- `OTEL_LOG_USER_PROMPTS`: `1` to include prompt text
- `OTEL_LOG_TOOL_DETAILS`: `1` to include tool names

Metrics:
- `claude_code.cost.usage` (USD, by model)
- `claude_code.token.usage` (by type: input/output/cacheRead/cacheCreation, by model)
- `claude_code.session.count`
- `claude_code.lines_of_code.count` (by type: added/removed)
- `claude_code.commit.count`, `claude_code.pull_request.count`
- `claude_code.active_time.total` (seconds)

Events (via OTel logs):
- `claude_code.api_request`: model, cost_usd, duration_ms, input/output/cache tokens
- `claude_code.tool_result`: tool_name, success, duration_ms, error
- `claude_code.user_prompt`: prompt_length

#### 5. Other Files

- `~/.claude/history.jsonl` -- prompt history (text, timestamp, project, sessionId)
- `~/.claude/sessions/<pid>.json` -- `{ pid, sessionId, cwd, startedAt }`

### Active Session Detection

Running Claude Code sessions write `~/.claude/sessions/<pid>.json`. Check if PID is alive to find active sessions.

Env var `CLAUDECODE=1` is set inside Claude Code processes.

---

## OpenCode

### Data Interface: SQLite

DB path: `.opencode/opencode.db` (in working directory)

WAL mode, foreign keys enabled.

#### Tables

**`sessions`**:
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `parent_session_id` | TEXT | nullable (sub-sessions for tasks/titles) |
| `title` | TEXT | auto-generated |
| `message_count` | INTEGER | via trigger |
| `prompt_tokens` | INTEGER | latest response's input tokens |
| `completion_tokens` | INTEGER | latest response's output tokens |
| `cost` | REAL | cumulative USD |
| `summary_message_id` | TEXT | post-compaction summary |
| `created_at` | INTEGER | unix timestamp |
| `updated_at` | INTEGER | unix timestamp |

**`messages`**:
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `session_id` | TEXT FK | |
| `role` | TEXT | user/assistant/system/tool |
| `parts` | TEXT | JSON array of typed parts |
| `model` | TEXT | model ID |
| `created_at` | INTEGER | unix timestamp |
| `finished_at` | INTEGER | nullable |

**`files`**: snapshot of file contents per session.

#### Message Parts Format

JSON array where each element is `{"type": "<type>", "data": {...}}`:
- `text`: `{"text": "..."}`
- `reasoning`: `{"thinking": "..."}`
- `tool_call`: `{"id", "name", "input", "type", "finished"}`
- `tool_result`: `{"tool_call_id", "name", "content", "metadata", "is_error"}`
- `finish`: `{"reason": "end_turn|max_tokens|tool_use|canceled|error", "time": unix_ts}`

#### Useful Queries

```sql
-- Sessions with cost
SELECT id, title, message_count, cost, datetime(created_at, 'unixepoch')
FROM sessions WHERE parent_session_id IS NULL ORDER BY created_at DESC;

-- Total spend
SELECT SUM(cost) FROM sessions;

-- Tool calls
SELECT m.session_id, m.model, m.parts
FROM messages m WHERE m.parts LIKE '%tool_call%';
```

#### Config

`.opencode.json` in working dir or `$HOME/.opencode.json`. Key fields:
- `data.directory` (default `.opencode`)
- `agents.{coder,summarizer,task,title}` with `model`, `maxTokens`
- `providers.{anthropic,openai,...}` with `apiKey`, `disabled`
- `debug` (enables file logging to `{data.directory}/debug.log`)

---

## Common Data Model

Fields available from both tools:

| Field | Claude Code | OpenCode |
|---|---|---|
| Session ID | `session_id` | `sessions.id` |
| Model | `model.id` / `.message.model` | `messages.model` |
| Input tokens | `context_window.current_usage.input_tokens` | `sessions.prompt_tokens` |
| Output tokens | `context_window.current_usage.output_tokens` | `sessions.completion_tokens` |
| Cache tokens | `cache_creation/read_input_tokens` | via provider TokenUsage |
| Cost USD | `cost.total_cost_usd` | `sessions.cost` |
| Tool calls | OTel events / JSONL progress | `parts` JSON with type=tool_call |
| Timestamps | `timestamp` fields | `created_at` unix epoch |

---

## Tools That Don't Expose Local Data

**GitHub Copilot**: No local token counts, cost, or metrics. Org-level API only (`/orgs/{org}/copilot/metrics`), requires enterprise. Sunsetting April 2026.

**Cursor**: Enterprise Analytics API only (`api.cursor.com/analytics/team/`).

**Continue.dev**: PostHog telemetry upstream only, no local access.

**Aider**: `--analytics-log` and `--llm-history-file` flags for opt-in local logging, but no structured database or real-time interface.
