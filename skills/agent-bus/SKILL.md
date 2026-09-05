---
name: agent-bus
description: Spawn and message agent lanes through boop (beep, lane create, wait, debug). Use whenever spawning a lane or messaging another harness session; never adlib tmux spawns.
---

# agent-bus (boop, since 2026-08-09; verb set of 2026-08-25)

CLI: `boop` (hafley-rs `crates/boop`; `~/.cargo/bin/boop`, rebuild with
`cargo install --path crates/boop --force` from hafley-rs main; per-branch
builds go to `~/.cache/boop/bin/boop-<branch>`).
Mailbox: one sqlite store `~/.agent/boop.db`, tables `agent_mail` and
`agent_route`. `--mail-dir` names the directory holding it.
`boop --help` is the usage contract and carries this whole primer (READ,
FAVORITE, SHELL, IDENTITY, PRESETS, LAWS); read it before inventing a flag
or writing SQL.

## Verbs (9)

| verb | job |
| --- | --- |
| `boop tui <harness>` | run an interactive TUI in this pane and register it (stamps `BOOP_SESSION`) |
| `boop beep <route> <body>` | the one send; blocks for the answer |
| `boop beep lane create` | worktree at base sha + spawn + route, one shot |
| `boop beep lane list/get/pane/patch/delete/prune` | lane registry; `list --all` adds unregistered tmux sessions and claude Agent-tool worktrees |
| `boop beep agent register/done` | pane-less routes (native subagents, coordinators) |
| `boop beep paste <file> --route <r>\|--pane <t>` | file onto the OS pasteboard + the harness paste key in its pane (claude, codex: Ctrl+V take it as an image); otherwise the quoted path is typed |
| `boop beep ps [<lane>]` | pid, rss, cpu per lane |
| `boop wait <id-or-lane>` / `--me` | block on a reply, a lane's rc, or your next unread row |
| `boop debug [<lane>]` | what just went wrong, grouped by lane |
| `boop db search/sessions/lanes/mail/schema` | read the store without SQL (7-day default windows) |
| `boop db "<sql>"` / `db sync/status/chat` | read the store |
| `boop me favorite -1 [--note]` / `boop db favorite list` | pin and read favorites |
| `boop whoami [--as]` / `boop config presets` | identity and model presets |

## Spawn

```bash
boop beep lane create --branch feature/<name> --brief <abs> --preset <p> \
  [--goal <text>] [--wait [--wait-timeout <s>]] [--cwd <repo>] \
  [--base-sha <sha>] [--parent <route>] \
  [--expect-path <rel>]... [--expect-commit-subject <text>]... \
  [--expect-commits-at-least <n>] [--dry-run]
```

- Model spelling is presets only: `boop config presets` lists name, harness,
  model, effort, bin. Lane defaults: `flash4` or `pro4`; `luna` for codex
  (`sol` only on an explicit ask); `k3` for kimi; `glm53` for claude through
  z.ai (`ccz`); `gem37` for gemini through opencode (allowed, user 2026-09-02;
  only codex/gpt and claude families are refused through opencode).
- The branch is the identity: `feature/schema-emit` gives lane and tmux
  `feature-schema-emit`, worktree `.boop-worktrees/feature/schema-emit`.
  Kinds `feature/ fix/ refactor/ chore/`, a convention the CLI prints.
- Always `--dry-run` first; the `cmd:` line is the literal spawn.
- Give each lane its own `CARGO_TARGET_DIR` (shared target dirs race).
- Completion is typed: `--expect-path` (worktree file exists),
  `--expect-commit-subject` (exact subject after base sha),
  `--expect-commits-at-least <n>`. A clean exit with an unmet assertion is
  rewritten to rc=4 with the failed assertions in the row's detail.
- Brief rule: the lane works in `$PWD` (its worktree). Never write an
  absolute `cd` to the primary checkout into a brief; a lane that does so
  commits on main in the primary tree (lane-completion, 2026-08-25).

## Send and wait

```bash
boop beep <route> "<body>" [--timeout <s>] [--kind <k>] [--as <name>]
boop beep <route> "<body>" --no-wait
boop beep parent "<body>"          # your own parent edge
boop beep children "<body>"        # every live child
boop wait <message-id>             # the reply
boop wait <lane>                   # the lane's result row, exits with its rc
boop wait --me [--as <name>]       # next unread row addressed to you
```

Delivery ladder, one transition row per rung: door (claude socket, codex
remote-control queue, opencode `prompt_async`) -> held-for-turn-boundary ->
hook inbox -> pane paste (never for claude/codex routes) -> held-in-mailbox.
Kimi has no door; spawn a lane. `boop wait <id>` prints the ladder walked.
Exits: 0 reply or recipient's turn ended, 124 timeout, 3 route died,
4 lane exited clean but an `--expect-*` assertion failed.
`boop wait <lane>` reads result rows newer than the newest taken inbound row,
so a stale result from an earlier run is skipped.
The last line of every exit is the next command to run.

## Identity

Two rungs only: `--as <name>`, then the `BOOP_SESSION` env stamp. `boop tui`
writes the stamp; a session that predates it passes
`BOOP_SESSION=<name>` on spawns or `--as` on every verb.

A native subagent shares its spawner's process, so the stamp names the
spawner. `boop beep agent register <name> --parent <route>` prints the
instruction; every verb the native runs carries `--as <name>`. A bare
`wait --me` under a lane stamp that has live native children is refused
with the candidates listed (native-subagent-identity).

Codex native subagents need process-level `sandbox_mode=danger-full-access`
plus ACP session mode `agent-full-access`, or their `boop` calls cannot write
the mail dir or `.git/worktrees`.

## Supervision (what the parent learns without the model's help)

The lane supervisor writes to the parent's mailbox on every turn end
(`idle <lane> turn=<reason> head=<sha> dirty=<n>`), every HEAD move
(`commit <a>..<b>`), and every exit path (`lane <id> done rc=<n>`), signalled
panes included. Do not poll; `boop wait <lane>`.

## Laws
- Every lane spawn goes through `lane create` (user-set 2026-08-03). Bare
  tmux spawns leave no edge and the strip cannot show the lane.
- Claude-model workers on the user's own plan run as the coordinator's native
  subagents (Agent tool). boop lanes are for opencode, codex, kimi, and
  ccz/z.ai claude (`--preset z*`). Never launch subagents on Fable.
- A LANE CAN DIE SILENTLY. Liveness is TWO checks: process alive
  (`boop beep ps <lane>`) AND worktree changed (`git status --short`). A
  REPORT.md at the root proves nothing alone.
- `opencode run` and one-turn briefs take mid-turn hails at the next turn
  boundary; HeadWatch reports commits regardless.
- `boop beep message ack` is bulk-mark only. Ack proves READ, never
  compliance; compliance = the work's own artifacts.
- `lane delete --state dead` removes each dead lane's own worktree and nothing
  above it; `--dry-run` first. Nothing in boop runs `rm -rf` on
  `.boop-worktrees`.
- Session id for a lane: `boop beep lane get <lane>` (route cwd = the
  worktree). Everything a lane did: `boop debug <lane>`.
- Liveness for a pane-less route (native subagent, coordinator with no
  pane) is measured from its parent; `lane list --all` shows it.
