# beads — Quick Reference

Distributed issue tracker. Git-backed. AI/human friendly.

---

## Install

```bash
brew install beads
# or
npm install -g @beads/bd
```

Verify:
```bash
bd --version
```

---

## Init in a Project

```bash
cd ~/projects/claude-research
bd init
```

This creates `.beads/` in the repo. Commit it:
```bash
git add .beads
git commit -m "init beads tracking"
```

Stealth mode (no git hooks, no commits):
```bash
bd init --stealth
```

---

## Daily Workflow

### 1. See what's ready
```bash
bd ready
```

Shows unblocked tasks. Use `--json` for scripts/agents:
```bash
bd ready --json --quiet
```

### 2. Create work
```bash
bd create "Refactor parser" -p 1
bd create "Add CLI flags" -p 2
```

Priority: `-p 0` (critical) through `-p 3` (low)

### 3. Link dependencies
```bash
bd dep add <child-id> <parent-id>
```

Example:
```bash
bd dep add bd-a1b2 bd-c3d4
```

### 4. Claim and do
```bash
bd update bd-a1b2 --claim --status in_progress
```

`--claim` prevents collisions when multiple agents/humans work together.

### 5. Close
```bash
bd close bd-a1b2 "Done. Tests pass."
```

---

## Hierarchy (Epics)

Create an epic, then subtasks:
```bash
bd create "Auth system" -p 0         # bd-a3f8
bd create "OAuth flow" -p 1          # bd-b2c1
bd create "JWT middleware" -p 1      # bd-d4e5
```

Link as parent-child:
```bash
bd dep add bd-b2c1 bd-a3f8
bd dep add bd-d4e5 bd-a3f8
```

Or use dot-notation IDs (epic.task.subtask):
```
bd-a3f8       # epic
bd-a3f8.1     # task under epic
bd-a3f8.1.1   # subtask
```

---

## Agent Integration

Add to `AGENTS.md` or `.claude/CLAUDE.md`:
```
Use `bd` for task tracking.

Workflow:
1. Run `bd ready --json --quiet` to find unblocked work
2. Claim with `bd update <id> --claim --json --quiet`
3. After work: `bd close <id> "summary"`
4. Sync: `git add .beads && git commit -m "bd: ..."`
```

Always use these flags for agents:
- `--json` — machine-readable output
- `--quiet` — no progress bars
- `--no-color` — clean text

---

## Sync Between Machines

```bash
# Before starting work
git pull --rebase
bd ready

# After finishing work
bd close bd-a1b2 "Done"
git add .beads
git commit -m "bd: close auth flow"
git push
```

Dolt handles cell-level merge conflicts. If git conflicts arise, resolve `.beads/issues.jsonl` manually (it's just text).

---

## Backup

The whole state is in `.beads/`:
```bash
bd backup init /path/to/backup
cd ~/projects/claude-research
bd backup sync
```

Or just `cp -r .beads .beads.backup.$(date +%Y%m%d)`.

---

## Useful Flags

| Command | Purpose |
|---------|---------|
| `bd show <id>` | Full task details + audit trail |
| `bd list --status open` | All open tasks |
| `bd list --assignee me` | Your tasks |
| `bd prime` | Compact context for LLM (1-2k tokens) |
| `bd sync` | Export JSONL, commit, push |

---

## Storage Location

Default: `.beads/` inside the git repo.

Override:
```bash
export BEADS_DIR=/path/to/project/.beads
bd init --stealth
```

---

## Gotchas

- `bd` needs the git repo. Run from inside `~/projects/claude-research`, not a subdirectory.
- `--stealth` disables git hooks. Good for eval/testing, bad for sync.
- The SQLite cache (`.beads/beads.db`) is gitignored. Only `issues.jsonl` travels.
- Old closed tasks get compacted automatically to save context window.
