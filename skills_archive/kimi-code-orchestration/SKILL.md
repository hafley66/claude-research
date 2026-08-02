---
name: kimi-code-orchestration
description: Drive Moonshot's kimi-code CLI (k3, kimi-for-coding) as a sub-agent from a coordinator (Claude Code, Fable, scripts). Print mode, ACP, local REST/WebSocket server, official SDK, session control, tmux fallback, CI hygiene.
trigger: kimi -p, kimi print mode, kimi headless, kimi acp, kimi server, kimi subagent, kimi orchestration, kimi coordinator, call kimi from claude code, kimi-code automation, kimi sdk, kimi tmux
---

# kimi-code Orchestration — Coordinator Agents Calling Kimi

How an external agent (Claude Code / Fable / scripts) invokes **kimi-code CLI** (`kimi`, v0.26.0+) as a worker. Verified against installed binary 0.26.0 and official docs (2026-07).

**Two CLI generations — do not confuse:** legacy Python `kimi-cli` (`~/.kimi`, v1.x) vs current TypeScript `kimi-code` (`~/.kimi-code`, v0.x). Everything here is kimi-code.

## Decision Table

| Need | Surface |
|------|---------|
| One-shot delegation, shell out, capture text | `kimi -p` (print mode) |
| Multi-turn, streaming, approvals, interrupts | `kimi acp` (JSON-RPC stdio) |
| Many parallel sessions over HTTP, long-lived daemon | `kimi server run` (REST + WebSocket) |
| Programmatic control from Go/Node/Python | `@moonshot-ai/kimi-agent-sdk` |
| Nothing else works | tmux drive (last resort) |

## 1. Print Mode (simplest)

```bash
cd /target/repo && kimi -p "add tests for the parser" --output-format stream-json 2>/dev/null
kimi -m kimi-code/kimi-for-coding -p "explain the latest diff"
```

Flags (from `kimi --help`):
- `-p, --prompt <prompt>` — one non-interactive prompt, streams answer to stdout, exits
- `-m, --model <alias>` — model alias from `~/.kimi-code/config.toml`
- `--output-format text|stream-json` — only with `-p`; stream-json = one JSON object per line (assistant msgs, tool_calls, tool results; thinking NOT included)
- `-S, --session [id]` / `-c, --continue` — resume (see §5)
- `--skills-dir <dir>` (repeatable), `--add-dir <dir>` (repeatable)

Contracts:
- **stdout** = assistant text; **stderr** = thinking, tool progress, "resuming session" notices
- **Permissions**: no approvals ever requested in print mode; tool calls run under `auto` policy; static `deny` rules in config.toml still apply. `-p` conflicts with `--yolo`, `--auto`, `--plan` (docs' config-overrides page shows a stale `kimi --yolo -p` example — command reference wins)
- **Exit codes**: no formal contract; failed turns exit non-zero (fixed in 0.23.2)
- Background tasks in print mode: `[background] print_background_mode = "exit"|"drain"|"steer"` (default `steer` — background completions inject new turns); `print_wait_ceiling_s`, `print_max_turns` bound the loop. Background Bash/subagents default to NO timeout in `-p`

NOT in print mode: token-usage reporting (SDK/ACP or TUI `/usage` only), stdin piping (undocumented), `--cwd` flag (set child process cwd instead, or `--add-dir`)

## 2. ACP — `kimi acp` (richest in-process control)

JSON-RPC over stdio, speaks [Agent Client Protocol](https://agentclientprotocol.com/). Long-lived subprocess; the coordinator talks methods:

| Method | Notes |
|--------|-------|
| `initialize`, `authenticate` | handshake |
| `session/new` | accepts `cwd` + `mcpServers` |
| `session/load`, `session/resume`, `session/list` | session lifecycle |
| `session/prompt` | streams `agent_message_chunk` |
| `session/cancel` | interrupt |
| `session/set_config_option` | runtime config |
| reverse-RPC: `session/request_permission`, `fs/read_text_file`, `fs/write_text_file` | server calls client |

Not implemented: `session/close`, `logout`, terminal reverse-RPC. Any ACP client lib works (e.g. `@agentclientprotocol/sdk`); [gua](https://github.com/CMGS/gua) runs "Kimi via ACP" in production.

## 3. Local Server — `kimi server run`

Loopback REST + WebSocket daemon + web UI. Default port **58627**, bearer-token auth, `--dangerous-bypass-auth` to disable.

```bash
kimi server run                  # foreground-ish; --keep-alive, --foreground flags
kimi server install              # macOS LaunchAgent: ~/Library/LaunchAgents/ai.moonshot.kimi-server.plist
kimi server start|stop|restart|status --json
kimi server ps                   # list sessions
kimi server kill
kimi web                         # = server run --open
```

API specs served live: `GET /openapi.json` (REST), `GET /asyncapi.json` (WebSocket). Best surface for many parallel sessions from an HTTP-speaking coordinator.

## 4. Official SDK — [kimi-agent-sdk](https://github.com/MoonshotAI/kimi-agent-sdk)

Go, Node (`npm i @moonshot-ai/kimi-agent-sdk`), Python (`pip install kimi-agent-sdk`). Spawns the `kimi` executable, speaks its wire protocol:

```js
createSession({ workDir, sessionId?, model?, thinking?, yoloMode?, executable?, env? })
// streaming Turn events: ContentPart, ToolCall, ApprovalRequest (programmatic approve()),
// StatusUpdate (has token_usage), multi-turn prompts on one session
// listSessions(workDir), parseSessionEvents()
```

Caveat: Node README path constants reference `~/.kimi` (legacy home) — verify CLI generation your SDK version targets.

## 5. Session Control from Scripts

```bash
kimi --session 01HZ...XYZ        # or -S <id>, -r <id>, kimi resume <id>
kimi --continue                  # latest session in cwd
kimi -p "follow-up" --session <id>   # documented compatible (no combined example in docs; verified working pattern)
```

Session-id discovery on disk (`$KIMI_CODE_HOME`, default `~/.kimi-code`):
- `session_index.jsonl` — one JSON record per line: `sessionId`, `sessionDir`, `workDir`. Read last record before/after a `-p` run to learn the new id
- `sessions/<workDirKey>/<sessionId>/` — `state.json` (title, lastPrompt, forkedFrom), `agents/*/wire.jsonl`
- Programmatic: ACP `session/list`, SDK `listSessions()`, `kimi vis`/`kimi export <id>` for inspection

## 6. tmux Fallback (last resort)

No official docs; pattern from AWS [cli-agent-orchestrator](https://github.com/awslabs/cli-agent-orchestrator/blob/main/docs/kimi-cli.md) (targets legacy CLI, mechanics transfer):

```bash
tmux new-session -d -s w1 -x 220 -y 50 'cd /proj && TERM=xterm-256color kimi --yolo'
tmux send-keys -t w1 'prompt text' Enter
# poll: tmux capture-pane -t w1 -p | tail -50 — idle = 💫/✨ prompt glyph visible
# response = text between echoed prompt line and next bare prompt; filter gray-ANSI thinking bullets
tmux send-keys -t w1 '/exit' Enter
```

Gotcha: kimi exits silently under `TERM=tmux-256color` — force `xterm-256color`. Only use when 1–4 are unavailable.

## 7. Env Vars & CI Hygiene

```bash
KIMI_CODE_HOME=$PWD/.kimi-sandbox   # isolate all state per-run
KIMI_MODEL_*                        # synthesize throwaway model without editing config
KIMI_CODE_NO_AUTO_UPDATE=1          # pin version
KIMI_DISABLE_TELEMETRY=1
kimi login                          # RFC 8628 device code, non-interactive
kimi provider add / catalog add --api-key   # scripted CI credential setup
kimi doctor                         # validate config (exit 0/1)
```

Known CI friction: OAuth vs API-key in headless ([kimi-cli#2442](https://github.com/MoonshotAI/kimi-cli/issues/2442)).

## 8. Does NOT Exist

- MCP *server* mode (kimi is MCP client only — `~/.kimi-code/mcp.json`, `/mcp-config`)
- Official GitHub Action (community: [kimi-code-reviewer](https://github.com/howardpen9/kimi-code-reviewer), [kimi-actions](https://github.com/xiaoju111a/kimi-actions))
- Token usage in `-p` output; formal exit-code spec; `--cwd`; documented stdin piping

## 9. Cost-Tier Routing Recipe

Coordinator passes `-m` per task difficulty — cheap model first, escalate on weak output:

```bash
kimi -m kimi-code/kimi-for-coding -p "$TASK"      # K2.7: cheap/fast, 256K ctx
kimi -m kimi-code/k3 -p "$TASK"                   # K3: flagship, effort=max only, 1M ctx (plan-gated)
```

K3 thinking is always-on, `reasoning_effort` accepts only `max` (low/high promised). Context by plan: Andante = no k3, Moderato = 256K, Allegretto+ = 1M. Third-party agents: set context window 1048576 manually — many tools clip below max.

## Sources

- Command reference: https://moonshotai.github.io/kimi-code/en/reference/kimi-command.html
- ACP reference: https://moonshotai.github.io/kimi-code/en/reference/kimi-acp.html
- Config files: https://moonshotai.github.io/kimi-code/en/configuration/config-files.html
- Sessions guide: https://moonshotai.github.io/kimi-code/en/guides/sessions.html
- Data locations: https://moonshotai.github.io/kimi-code/en/configuration/data-locations.html
- SDK: https://github.com/MoonshotAI/kimi-agent-sdk
- Real-world integrations: [parley](https://github.com/KerryRitter/parley), [openclaw cli-worker](https://github.com/openclaw/skills/blob/main/skills/quratus/cli-worker/SKILL.md), [claude-anyteam](https://github.com/JonathanRosado/claude-anyteam/blob/main/docs/configuration.md), [gua](https://github.com/CMGS/gua), [hcom](https://github.com/aannoo/hcom), [tmux-bridge-mcp](https://github.com/howardpen9/tmux-bridge-mcp)
