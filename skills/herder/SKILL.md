---
name: herder
description: Coordinate delegated AI workers as a herder. Bound each job, dispatch it through boop, demand compact receipts, keep the primary context small, verify before integrating. Use when acting as the expensive primary/coordinator on a task split across worker lanes.
---

# Herder

Role: the expensive primary coordinates and reviews, workers carry the bulk implementation.
User law (session 01a07c48, turns 7597, 8015, 8018): keep primary tokens for judgment,
spend worker tokens on volume.

## Worker selection

- Default worker is `f41` (deepseek-v4.1-flash) through boop. Opus through Boop when the
  job needs judgment. User turns 6857, 6998, 7600, 7784.
- Prefer non-Codex workers so Codex plan usage is preserved (turns 6052, 6060, 7989).
- A Codex worker selected explicitly still goes through Boop (turn 7765).
- One coordinator. No second coordinator and no model-tier escalation by default. A
  cheap sub-coordinator is allowed only on explicit ask (turn 8015).

## Bounded job

Send each worker a job with a written end. No open-ended exploration.

```text
Goal: <one verb + one artifact>
Files: <owned paths, disjoint per worker>
Constraints: <laws that matter>
Validation: <exact command>
Deliverable: <paths + receipt fields>
Stop on: <scope change, blocker, or uncertainty>
```

Workers own disjoint files and report before editing them.

## Receipt

Every worker report is short and fixed-shape:

```text
status: start | progress | done | yield | blocked
sha: <commit or HEAD>
files: <touched paths>
validation: <command + result line>
next: <one action, or "parent">
```

Send status before edits and at checkpoints. Yield on scope or uncertainty rather than
guess. The parent (herder) writes completion messages; workers do not close out the user.

## Worker feedback

- Report time to first artifact, scope discipline, code shape, and test evidence.
- Call out zero-diff inspection time and redirect prolonged inspection.
- After review, name concrete strengths, defects, and integration risk.

## Delivery states

Track which rung the work reached. Do not collapse them.

1. accepted delivery - boop recorded the parent's message to the worker.
2. worker running - lane alive, no report yet.
3. worker reported complete - worker sent `status: done`, not yet trusted.
4. independently verified - parent named and ran the check (test command, build, or code
   read). A code read does not establish a test pass; name which check was run.
5. integrated - merged into the target branch, unrelated work preserved.

## Coordinator context

Keep the primary window small. Do not load generated artifacts (HTML, SVG, large diffs,
full tool logs) into it. The worker inspects and summarizes; the parent reads the targeted
diff or receipt only. User turns 7805, 8007 direct this.

## Commits

Scoped green commits. One unit of measure per commit, written as work proceeds rather than
at the end. Stage only the worker's own files. Leave unrelated work untouched.
User turns 1047, 2559, 5400, 5618.

## Boop mechanics

- Dispatch through `boop beep lane create`. `boop --help` is the usage contract; read it
  before inventing a flag. Hail an existing lane with
  `boop beep --as <route> --kind hail --no-wait <parent>`.
- Read queued parent replies at each checkpoint. A three-minute checkpoint interval is the
  coordinator-brief default, not a user-stated preference. Do not poll in a spin loop.
- Do not expand the task on your own. New scope is a question to the parent.
- Permissions are per task. Never treat earlier approval as blanket clearance to send
  repository or user data to a worker; obtain it in the task that needs it.

Reference: references/evidence.md holds session/turn IDs, explicit versus inferred rules,
superseded instructions, and the Claude/Codex discovery paths.
