---
description: Commit with human-first attribution
allowed-tools: Bash(git *)
---

# /git-commit

## Steps

1. Run `git status` and `git diff --cached --stat` to see what's staged. If nothing is staged, show status and ask what to add.
2. Run `git log --oneline -5` to match the repo's commit message style.
3. Write the commit message as a heredoc. Format:

```
<short summary line>

Directed by: <what the human decided, requested, or designed>
Implemented by: Claude — <what was coded, configured, or wired up>

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

The "Directed by" line captures the human's contribution -- their ideas, decisions, corrections, design calls. The "Implemented by" line captures what the AI actually did to execute.

4. Commit:
```
git commit -m "$(cat <<'EOF'
...
EOF
)"
```

One commit call. No interactive flags. No --amend unless explicitly asked.
