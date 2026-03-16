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

<what changed and why -- plain factual description of the diff, no attribution>

Directed by: <what the human decided, requested, or designed>
Implemented by: Claude -- <what was coded, configured, or wired up>

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

Three layers, in order:
- **Facts**: what the diff does and why, readable by anyone with no context on who did what
- **Human**: the decisions, design calls, corrections, and direction the human provided
- **AI**: what Claude actually executed to implement those decisions

4. Commit:
```
git commit -m "$(cat <<'EOF'
...
EOF
)"
```

One commit call. No interactive flags. No --amend unless explicitly asked.
