---
name: agent-bus
description: Spawn and message agent lanes through boop (hail, lane create, list, resolve). Use whenever spawning a lane or messaging another harness session; never adlib tmux spawns.
---

# agent-bus (boop, since 2026-08-09)

CLI: `boop` (sprefa `v6/boop`; shim `~/projects/claude-research/bin/boop` ->
`target/release/boop`, rebuild with `cargo build --release` after boop PRs).
Mailbox: `~/.agent/mail/` — `bus.ndjson` (append-only) + `registry.json`.
Override with `--mail-dir`. The instant strip reads the same mailbox.

## Verbs

```bash
boop beep lane create --branch feature/<name> --brief <abs> \
  [--goal <text>] [--model <m>] [--wait [--wait-timeout <s>]] \
  [--cwd <repo>] [--base-sha <sha>] [--parent <coord>] [--harness <id>] \
  [--lane <id>] [--tmux <name>] [--socket <s>] [--mail-dir <d>] [--dry-run]
                              # worktree at base sha + spawn + route, one shot
boop beep hail <lane> --body "text" [--from <a>] [--kind <k>] [--wait-timeout <s>] [--mail-dir <d>]
                              # lane route: handed to its supervisor (ACP).
                              # coordinator route (a `boop tui` pane): through the
                              # harness door, never typed: claude unix socket,
                              # codex queue on the remote-control daemon, opencode
                              # prompt_async on boop's serve (:4097). Recipient takes
                              # it as its next prompt; nobody reads a mailbox.
                              # --wait-timeout blocks until a reply mail OR the
                              # recipient's turn ends ("<route> turn ended").
                              # One ledger row per hail: agent_delivery (outcome
                              # injected | queued-for-turn-boundary | unreachable).
                              # kimi TUI has no door: spawn a lane instead.
boop beep lane wait <lane> [--timeout <s>]   # exits with the lane's rc, 124 on timeout
boop beep lane list|get|route|pane|patch|delete
boop beep message ack         # bulk-mark handled (age-based, NOT proof-of-read)
boop beep ps                  # pid, rss, cpu per lane
boop db sync|usage|status     # transcript ingest + token/cost
```

THE BRANCH IS THE IDENTITY. One derivation, from the whole branch name:

```
--branch feature/schema-emit
  lane id + tmux session  feature-schema-emit     # `/` spelled `-`, nothing dropped
  worktree                <repo>/.boop-worktrees/feature/schema-emit
```

Kinds are `feature/ fix/ refactor/ chore/`, a convention the CLI prints, never
a gate; no `lane/` prefix is required or added. Everything obvious defaults:
`--cwd` = the repo you stand in (a linked worktree resolves to its owner),
`--base-sha` = origin/main's head resolved at spawn and printed, `--parent` =
you, then the one registered coordinator, `--harness` = whatever the model
spelling names (`gpt-*` codex, `provider/model` opencode, `kimi-*` kimi; a
claude model stops, since those are Agent-tool work). `--lane` and `--tmux`
stay as overrides for a row that already exists.

The whole spawn is two flags:

```bash
boop beep lane create --branch feature/schema-emit \
  --brief /Users/chrishafley/projects/sprefa/TASKS/schema-emit.BRIEF.md --dry-run
# cmd: opencode run -m 'openrouter/deepseek/deepseek-v4-flash-0731' --auto "$(cat ...)"; ...
# to: feature-schema-emit
# cwd: /Users/chrishafley/projects/sprefa
# branch: feature/schema-emit (kind feature)
# worktree: /Users/chrishafley/projects/sprefa/.boop-worktrees/feature/schema-emit
# base-sha: 0d2bbb8b129a35d9d013d510ca82ccdee9934317 (from origin/main)
# tmux: feature-schema-emit
# parent: sprefa-coordinator (from registry; completion hail appended on exit)
```

`--parent` appends an on-exit hail `lane <id> done rc=$__rc` from the lane
into the dispatch's mailbox (measured 2026-08-09: `from=spin2 rc=0`), so
boop lanes REPORT COMPLETION. `--wait` blocks on that row and exits with the
lane's rc, making spawn-and-join one command; `--wait-timeout` defaults to
3600s and exits 124, `0` waits forever. Always `--dry-run` first; the `cmd:`
line is the literal spawn.

## Laws
- Every lane spawn goes through `lane create` (user-set 2026-08-03). Bare
  tmux spawns leave no edge and the strip cannot show the lane.
- Claude-model workers run as the coordinator's native subagents (Agent
  tool), never as tmux lanes: native carries inherited permissions,
  completion notifications, in-UI visibility. boop lanes are for non-claude
  harnesses (opencode, kimi, shell) and instant-e2e strip rows. `lane create`
  enforces this: a claude model spelling stops unless `--harness claude` says
  otherwise.
- A LANE CAN DIE SILENTLY, PRODUCING NOTHING (measured 2026-08-07). Liveness
  is TWO checks: process alive (`boop beep ps` or `ps | grep "opencode run"`)
  AND worktree changed (`git status --short`). A REPORT.md at the root proves
  nothing alone — check mtime + first line against the lane you dispatched.
- `opencode run` takes its prompt from ARGV: a mid-flight hail reaches
  nothing. Let it finish and re-dispatch with the session id, or kill it.
  Interactive TUIs launched via `boop tui <harness>` receive hails through
  their door. A codex TUI has no thread until its first prompt; a hail before
  that is refused by name (re-send after the human's first prompt).
- Proof-of-read ack still goes through cass (`bus sweep`, legacy
  instant/scripts/bus.ts); `beep message ack` is bulk-mark only. Ack proves
  READ, never compliance; compliance = the work's own artifacts.
- Recipients may challenge an unverified hail. Give scratch sessions a
  CLAUDE.md naming the expected `[bus m-*]` message.
- Session id for a lane: `boop beep lane route <lane>` (route cwd = the
  worktree since 2026-08-09). Raw fallback: opencode.db `session` table,
  `directory` is the join key.
