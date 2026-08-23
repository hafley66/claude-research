---
name: opencode-orchestration
description: Spawn opencode workers from a coordinator (Claude Code/Codex). Current doctrine = deepseek-v4-flash-0731 pinned to deepinfra for mechanical delegation lanes; glm z.ai plan for interactive default.
trigger: opencode run, deepseek flash, flash lane, spawn deepseek, opencode worker
---

# opencode orchestration (current prefs, 2026-08-02)

## BANNED FROM OPENCODE (user law 2026-08-11, enforced in boop)

codex/gpt, claude, and gemini model families NEVER run through opencode:
each has its own flat-rate-plan harness (codex = ChatGPT plan, claude =
Agent tool, gemini = gemini CLI), and opencode routes them through metered
API credit instead. Spell the BARE model name (`gpt-5.6-sol`, never
`openrouter/openai/gpt-5.6-sol`) so `boop beep lane create` derives the
plan harness. boop `lane.rs plan_harness_family` hard-bails these
spellings at spawn, `--harness opencode` included, no override.
Field receipt: two dead lanes + openrouter billing for gpt-5.6 models.

## The delegation model

`openrouter/deepseek/deepseek-v4-flash-0731`, pinned in
`~/.config/opencode/opencode.json`: provider order `["deepinfra"]`,
`allow_fallbacks: false`, `reasoning.effort: high`. Use the 0731 pin ONLY —
never the free route, never unpinned (other providers serve degraded quants).
Interactive default stays `zai-coding-plan/glm-4.6` (config `model`).

## Dispatch (boop doctrine, 2026-08-09)

Spawn through `boop` (sprefa `v6/boop`, shim at
`~/projects/claude-research/bin/boop` -> `target/release/boop`; rebuild with
`cargo build --release` after merging boop PRs, the shim tracks the binary).
Live-receipt verified 2026-08-09 end-to-end: worktree made at the base sha,
flash lane ran and committed, completion hail landed with `from=<lane>` in the
dispatch's own mailbox. Same `~/.agent/mail` mailbox as bus, so the instant
strip renders boop lanes unchanged.

| verb | what it does |
| --- | --- |
| `boop beep lane create --lane <id> --cwd <repo> --brief <abs> [--parent <coord>] [--branch <b> --base-sha <sha>] [--model <m>] [--tmux <name>] [--socket <s>] [--mail-dir <d>] [--dry-run]` | worktree + spawn + route, one shot. `--branch`+`--base-sha` = worktree mode at `<repo>/.boop-worktrees/<branch>`; `--parent` appends an on-exit hail `lane <id> done rc=$__rc` (lanes now REPORT COMPLETION). Harness defaults to opencode. |
| `boop beep hail <lane> --body <text>` | lane route: handed to the ACP supervisor; `boop tui` pane: through the harness door (nothing typed), `--wait-timeout` returns when the recipient's turn ends. Ledger row in `agent_delivery`. |
| `boop beep lane list/get/route/pane/patch/delete` | read/repair lane state (`patch` = old `bus adopt`). |
| `boop beep message ack` | bulk-mark mail handled (NOT transcript-proven; see cass note). |
| `boop beep ps` | pid, rss, cpu per lane. |
| `boop db sync/usage/status` | ingest + token/cost accounting, native transcript reads. |

Legacy: `bus` (instant scripts/bus.ts) still works against the same mailbox;
`bus sweep`'s cass transcript-proof ack has NO boop equivalent yet, so
proof-of-read still goes through cass until boop joins mail against its own
transcript store.

`opencode run` is ONE-SHOT: it finishes its turn and exits. A mailbox hail
reaches nothing after that. A second pass is a NEW spawn carrying the prior
session so context survives:

```bash
opencode run -s <sessionID> -m <model> --auto "$(cat FOLLOWUP.md)"
```

Session id for a worktree: `boop beep lane route <lane>` (route cwd is the
worktree since 2026-08-09, so directory-join resolution hits). Raw fallback:

```bash
sqlite3 ~/.local/share/opencode/opencode.db \
  "SELECT id FROM session WHERE directory LIKE '%<lane>%' ORDER BY rowid DESC LIMIT 1;"
```

Wait for pass 1 to exit before spawning pass 2, or the tmux name collides:

```bash
until ! tmux list-panes -t <lane> -F '#{pane_current_command}' 2>/dev/null \
  | grep -q opencode; do sleep 15; done
```

```bash
boop beep lane create --lane <lane-id> --cwd /abs/repo \
  --brief /abs/path/BRIEF.md --parent <coordinator-name> \
  --branch <lane-branch> --base-sha <sha>
```

- Model defaults to the flash pin; `--harness` defaults to opencode. Always
  `--dry-run` first and read the composed `cmd:` line — it is the literal
  spawn (verified byte-true 2026-08-09).
- `--brief` takes an ABSOLUTE path. A relative one resolves against the
  coordinator's shell cwd, not the lane's, and the spawned body points at a
  file that does not exist.
- Repair a live lane's registration with `boop beep lane patch`. Patch
  rewrites registry metadata only; re-running `lane create` spawns a SECOND
  agent (tmux dies with `duplicate session` if the name is live).
- Raw spawn, only when the lane must stay out of the registry:

```bash
cd /path/to/worktree && opencode run \
  -m openrouter/deepseek/deepseek-v4-flash-0731 --auto "$(cat BRIEF.md)" &
```

- `--auto` is mandatory in pipes (approval prompt hangs with no TTY).
- One worktree per lane, no commits unless the brief says commit,
  REPORT.md at worktree root is the deliverable contract.
- `--format json` = NDJSON per line; `-s <sessionID>` resume, `--fork` branch.
- Usage/cost per lane: `~/.local/share/opencode/opencode.db` (message.data
  json: tokens.input/output/reasoning, cost). 5-lane night = ~$0.78.
- Read progress with `tmux capture-pane -t <lane-id> -p | tail -20`.

## Flash doctrine (measured, plans/2026-08-02-flash-vs-opus-lane-report.md)

Flash = excellent brief-follower, weak skeptic. Brief quality is its ceiling.

- ROUTE-DEAD DAY (measured 2026-08-09, sprefa coordinator): 5 of 6 fresh
  flash spawns produced ZERO files. Two signatures: instant silent death
  (3-6 messages, clean exit) and ran-but-never-wrote (15-32 messages, no
  disk writes — smells like opencode tool-execution failure, not provider
  stall). Resumes recovered 2 of 5; the coordinator then declared the route
  dead for the day and rerouted every remaining lane to in-process sonnet.
  Rail: verify worktree change (never just process exit) on every lane; one
  resume max; after TWO zero-file lanes in a day the route is dead, reroute
  everything, stop paying the spawn tax. RCA probe (run 2026-08-09, same
  day, ~4h after the deaths): trivial write-one-file brief PASSED on BOTH
  paths — raw `opencode run` and `bus lane`/tmux — byte-exact file, clean
  exits. The zero-file signature did not reproduce, so the cause was
  transient (provider window or opencode transient), never a persistent
  path defect; note one flash lane from the dead day later completed and
  committed on its own (extract-prolog-refs bcc8e21e). Route usable again;
  the liveness rail above stays mandatory on every lane.
- TWO-PASS LAW (user-set 2026-08-07): no lane output lands off one shot.
  Coordinator plans the workflow, few coordinated lanes over many parallel
  one-shots; flash for discretely confident tasks, opus for anything with
  ambiguity that could punch us; every implementation pass is followed by a
  named second pass (flash debur for style/dead-code/receipt sweep, coordinator
  design-review before merge). Receipt for why: batchlab 2026-08-07, flash's
  E3 reintroduced a prefilter its own brief's REPORT.md had measured as a
  1.4x loss; an isolating control run by the coordinator saved the verdict.
  Tell every pass-1 lane it is pass 1 of 2 so it favors plain code.

- PREFER flash over claude subagents for any discretely-scoped medium task
  whose brief is well explained (user-set 2026-08-04, in service of shipping
  a performant well-dogfooded product, not of the agents themselves); reserve
  opus for diagnosis and mid-task trade-offs.
- GIVE flash: mechanical sweeps, renames, format-perfect doc/ledger entries,
  config edits — with receipts, file ownership, exact validation commands,
  and style laws stated inline so zero judgment calls remain.
- NEVER give flash: diagnosis, premise-doubting, wrong-layer risk. It fixed
  a non-bug and the wrong layer when the fed premise was wrong; opus lanes
  falsified 3 fed claims flash accepted. Diagnostic lanes go opus/codex.
- REVIEW law (user-set 2026-08-04, "really judge the work... be scrutinous
  on design dimensionality"): the coordinator's audit of a flash lane is a
  DESIGN review, never a gate echo. Green gates prove the brief was followed;
  they prove nothing about the brief. Re-derive at review: does the change
  sit at the right seam, does the contract stay coherent from the other
  side's view, what edge did the brief not enumerate, would a second caller
  of the touched surface agree with the shape. Read the diff hunk by hunk;
  own-run receipts; assume the lane did exactly what was asked and ask
  whether the ask was right.
- Tell it: "if reality deviates from this brief, STOP and report; do not
  improvise."

## Gotchas

Every brief NAMES the package manager. Flash defaults to `npm install`,
which in a pnpm/yarn repo rewrites the lockfile and un-dedupes types;
say the right tool inline and audit the typecheck even when the lane
REPORT claims green.

Cold start ~0.2-0.5s/run. `opencode serve`/ACP/SDK only if you outgrow
`run`. opencode.json `skills.paths` exposes claude-research + sprefa skills
to workers.
