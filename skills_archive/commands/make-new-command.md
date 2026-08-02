# What Are Slash Commands?

Slash commands are reusable prompt templates stored as Markdown files that you can invoke with `/command-name`. Think of them as shortcuts for instructions you use frequently.

## The Basics

A slash command is just a `.md` file in one of two locations:

| Scope | Location | Shows in `/help` as |
|-------|----------|---------------------|
| Project (shared with team) | `.claude/commands/` | `(project)` |
| Personal (all your projects) | `~/.claude/commands/` | `(user)` |

The filename becomes the command name. So `.claude/commands/review.md` becomes `/review`.

## Simple Example

```markdown
# .claude/commands/optimize.md

Analyze this code for performance issues and suggest optimizations.
Focus on:
- Time complexity
- Memory usage  
- Unnecessary allocations
```

Now you can just type `/optimize` instead of writing that out every time.

## Arguments

Pass dynamic values into your commands:

**All arguments with `$ARGUMENTS`:**
```markdown
# .claude/commands/fix-issue.md
Fix GitHub issue #$ARGUMENTS following our coding standards.
```
Usage: `/fix-issue 123` → `$ARGUMENTS` becomes `123`

**Positional arguments with `$1`, `$2`, etc:**
```markdown
# .claude/commands/review-pr.md
Review PR #$1 with priority $2 and assign to $3.
```
Usage: `/review-pr 456 high alice`

## Frontmatter (Optional Metadata)

Add YAML frontmatter to configure command behavior:

```markdown
---
description: Create a git commit with context
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*)
argument-hint: [commit message]
model: claude-3-5-haiku-20241022
---

Create a git commit with message: $ARGUMENTS
```

| Field | Purpose |
|-------|---------|
| `description` | Shown in `/help` |
| `allowed-tools` | Tools this command can use |
| `argument-hint` | Shows expected args during autocomplete |
| `model` | Use a specific model for this command |
| `disable-model-invocation` | Prevent Claude from auto-triggering this |

## Dynamic Context

**Execute bash commands with '!'**

```markdown
---
allowed-tools: Bash(git:*)
---

Current branch: \\! `git branch --show-current`
Recent commits: \\! `git log --oneline -5`
Staged changes: \\! `git diff --cached`

Based on the above, suggest a commit message.
```

**Reference files with `@`:**
```markdown
Review the implementation in @src/utils/helpers.js
Compare @src/old.js with @src/new.js
```

## Namespacing with Subdirectories

Organize commands in folders:
```
.claude/commands/
├── frontend/
│   └── component.md    → /component (project:frontend)
├── backend/
│   └── api.md          → /api (project:backend)
└── review.md           → /review (project)
```

The subdirectory shows in the description but doesn't affect the command name.

## SlashCommand Tool

Claude can programmatically invoke your custom slash commands during a conversation. To encourage this, reference the command by name in your instructions:

> "Run /write-tests after implementing any new function."

Requirements for auto-invocation:
- Must have `description` in frontmatter
- Must be a custom command (not built-in like `/compact`)
- Set `disable-model-invocation: true` to prevent this

## Slash Commands vs Skills

| | Slash Commands | Skills |
|---|---|---|
| **Structure** | Single `.md` file | Directory with `SKILL.md` + resources |
| **Invocation** | Explicit (`/command`) | Automatic (context-based) |
| **Complexity** | Simple prompts | Multi-file workflows with scripts |
| **Best for** | Frequent, quick tasks | Complex, discoverable capabilities |

## Quick Reference

```bash
# Create a project command
mkdir -p .claude/commands
echo "Your prompt here" > .claude/commands/my-command.md

# Create a personal command  
mkdir -p ~/.claude/commands
echo "Your prompt here" > ~/.claude/commands/my-command.md

# List all available commands
/help
```

## Pro Tips

1. Keep commands focused on one task
2. Use `$ARGUMENTS` for flexibility
3. Add `description` so `/help` is useful
4. Commit `.claude/commands/` to share with your team
5. Use bash execution to pull in dynamic context
6. Trigger extended thinking by including thinking keywords in your command
