---
name: opencode-orchestration
description: Call opencode from another CLI agent (Claude Code, Codex). Print mode (opencode run) and model-tier routing for the z.ai coding plan (glm-5.2 / glm-4.7).
trigger: opencode run, call opencode from claude code, opencode from codex, opencode worker, glm-5.2 worker, glm-4.7 dumbby
---

# opencode from another CLI

You are the coordinator (Claude Code / Codex). Shell out to `opencode run` (verified 1.18.3).

## The one command

```bash
cd /target/repo && opencode run -m zai-coding-plan/glm-5.2 --auto "do the task"
```

- `-m <provider/model>`: pick the tier (see below)
- `--format json`: NDJSON events on stdout, one per line; omit for plain text
- `--auto`: auto-approve tools. **Pass it** or a tool that needs approval hangs in a pipe (no TTY to answer it)
- `-f <file>`: attach a file, repeatable; stdin works too: `git diff | opencode run "..."`
- `-c` or `-s <sessionID>`: resume a session; `--fork` to branch without clobbering

stdout = the answer. That's the loop.

## Tier routing (z.ai coding plan)

opus = `zai-coding-plan/glm-5.2` (default, hard tasks). sonnet = `zai-coding-plan/glm-4.7` (cheap/dumbby).

```bash
opencode run -m zai-coding-plan/glm-4.7 --auto "$EASY_TASK"
opencode run -m zai-coding-plan/glm-5.2 --auto "$HARD_TASK"
```

Defaults go in `~/.config/opencode/opencode.json` so you skip `-m`:

```jsonc
{ "model": "zai-coding-plan/glm-5.2", "small_model": "zai-coding-plan/glm-4.7" }
```

`small_model` is the background/title/summary model = the dumbby slot.

## Gotchas

- Cold start ~0.2-0.5 s per run. Ignore it unless you're fanning out hundreds.
- `--format json` is newline-delimited JSON, not one document, not SSE. Parse line by line.
- Don't use `opencode serve`/ACP/SDK unless you outgrow plain `opencode run`. For one-shots from another agent, `run` is enough.

Sources: https://opencode.ai/docs/cli , https://github.com/zzzz23792364/opencode-copilot/blob/main/docs/decisions/D001-opencode-run-vs-serve.md
