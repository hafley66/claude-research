# /codex-delegate

Delegate a task to the Codex CLI (`codex exec`) from inside a Claude Code
session — non-interactive, sandboxed, worktree-isolated, background-monitored.
The pattern that ran sprefa's engine/mod.rs split (2026-07-11).

---

## Arguments

- `<plan-file> [task-class]`: launch codex on a brief. `plan-file` is a
  checked-in plan/brief markdown; `task-class` picks the model (below),
  default `opus`.
- `status`: tail the running codex task's output file and summarize progress.
- `review`: the codex branch finished — run the review gate before merging.

---

## Model routing (Chris's rule, updated 2026-07-11 evening)

Only two models exist: `gpt-5.6-luna` (=== Sonnet, cheap, the DEFAULT workhorse)
and `gpt-5.6-terra` (costs more, only when the brief leaves real decisions open).

Default to luna. The BRIEF's quality picks the model, not the task's size: a tight
spec (exact files, laws, gates, summary shape) goes to luna even when the diff is
large. Terra only when the brief leaves real decisions genuinely open, and terra
costs more, so justify it.

| task class | model | effort |
| --- | --- | --- |
| well-specified brief (any size) or mechanical | `gpt-5.6-luna` | high |
| brief leaves real decisions open | `gpt-5.6-terra` | medium |

There is NO escalation beyond terra. If terra stalls, ask Chris.

Effort via `-c model_reasoning_effort=<level>`. Verify the header echo after
launch: codex prints `model:` and `reasoning effort:` in its first 10 lines —
confirm they match before walking away.

## Sandbox law

- ALWAYS `--sandbox workspace-write`. NEVER `--full-auto` (permission
  classifiers block it, and rightly: approvals-off + dropped sandbox).
  workspace-write confines writes to [workdir, /tmp, $TMPDIR], network off.
- ALWAYS a dedicated git worktree so in-flight work elsewhere can't be
  touched: `git worktree add ../<repo>-codex-<slug> -b codex/<slug>`.
- Commit the brief/plan file to the base branch FIRST so the worktree
  contains it.
- **Pre-seed node_modules BEFORE launch** (measured 2026-07-31, sprefa
  comment-sweep lanes, cost two resume round-trips): fresh worktrees have no
  node_modules and the sandbox has no network, so `pnpm install` in every
  package dir the receipts touch, including packages the brief's scope does
  NOT edit (a prolog-only lane still needed tsv2 deps because its sweep
  receipt replays through node).
- **Socket-bind receipts cannot run in the sandbox** (`listen EPERM` on any
  server-booting test, same date): brief such receipts as
  fingerprint-unchanged (record pass/fail/skip counts + failure class before
  edits, require identical after) and the coordinator runs the real suite at
  review. Do not brief "make the suite green" when the suite binds ports.
- **Resume syntax**: flags go BEFORE the subcommand —
  `codex exec [flags] resume <session-id> - <<'EOF'`; flags after `resume`
  are rejected (`unexpected argument '--sandbox'`).
- **Coordinator-cut worktrees: codex CANNOT write git metadata** (measured
  2026-07-29, sprefa flow lanes): the worktree's real git dir is the main
  repo's `.git/worktrees/<name>/`, outside the sandbox's writable roots, so
  `git merge --ff-only` dies on `ORIG_HEAD.lock: Operation not permitted`
  and commits fail the same way. Launch shape for these lanes: base
  verification is READ-ONLY (`git rev-parse HEAD` compared against the brief
  sha, stated in the prompt), and the lane runs NO-COMMIT flow (tree left
  dirty, coordinator reviews file-by-file and commits). Do not tell a codex
  agent in a coordinator-cut worktree to merge or commit; it will correctly
  stop and the launch is wasted.

## Launch shape

```bash
cd ../<repo>-codex-<slug> && codex exec --sandbox workspace-write \
  -m gpt-5.6-terra -c model_reasoning_effort=medium - <<'EOF'
<the brief: point at the committed plan file, then the standing rules>
EOF
```

Run it as a background Bash task (long timeout); the output file is the
transcript — codex streams its reasoning + exec lines there.

## The brief must include (sprefa-tuned, adapt per repo)

1. Worktree + branch + base sha, "work ONLY inside this worktree".
2. The plan file path and "read it first, follow exactly".
3. Line numbers in plans are stale — re-find by symbol name.
4. Hard laws: pure-moves-only (for refactors), file-size law (300 target /
   500 hard / stop-and-propose), N+1 batching law, hermetic tool runs
   (`SPREFA_CONFIG=/nonexistent/x.toml DL_NO_DAEMON=1` + scratch `--db`),
   never touch `~/.local/state/<tool>` or running daemons.
5. Commit protocol: one cluster/step per commit, `git commit -n`
   (pre-commit hooks are un-hermetic), do NOT push.
6. Test budget: name the suite command and the max number of full runs.
7. Escape hatch: "if a step can't be done within the laws, STOP that step
   and note why in the final summary instead of improvising."
8. Required final summary shape (per-step commits, key metrics, skips+why).

## Monitoring

- The background task file IS the live transcript; `tail`/`grep exec` it.
- Resume a stopped session: `codex exec --sandbox workspace-write -m <model> -c model_reasoning_effort=<level> resume --last - <<EOF ...` — global flags go BEFORE the `resume` subcommand (after it: "unexpected argument"), and resume does NOT inherit the session's model/effort — re-pin `-m`/`-c` every time or it silently falls back to the config default. Verify the header echo again.
- Known noise: `hook: SessionStart Failed` at start is benign when the
  repo's hooks are disabled.

## Review gate (nothing codex does self-merges)

1. `git log --oneline base..codex/<slug>` — one commit per planned step?
2. For refactors: `git diff --color-moved=dimmed-zebra base..HEAD` — every
   hunk should render as a move; investigate anything that doesn't. Cheap
   automated twin: sorted-line diff of before/after file contents — the
   residue should be only `use`/`mod`/visibility lines.
3. KNOWN codex failure mode (sprefa split, 2026-07-11): leading doc comments
   and attributes DETACH from their functions at cluster boundaries — a fn
   lands in the new file wearing its old neighbor's docs, and attribute
   payloads (`#[tracing::instrument(fields(...))]`) get simplified. Check the
   comment-line multiset before vs after (`git grep -h` sorted diff) AND
   spot-check the first/last fn of each moved cluster for comment ownership.
4. Re-run the full suite yourself on the branch (don't trust the summary —
   batch 2 of the sprefa queue reported focused tests green while the full
   suite had 17 failures). NEVER chain the gate-read and the merge in one
   command (`cat result && git merge` merges regardless of what the result
   says — read first, merge as a separate decision).
5. Merge to the base branch from the orchestrating session; push stays a
   human decision.

## Trust wall

Codex has a per-repo trust prompt. `codex exec` in a fresh worktree of an
already-trusted repo works; a genuinely new path may need Chris to trust it
in codex once. NEVER manufacture or edit trust hashes in codex config.
