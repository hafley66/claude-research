---
name: backprop
description: Propagate learnings back into existing skills. Feed observations, corrections, gotchas, or new patterns discovered during a session and a subagent determines which skills to update and how.
license: MIT
compatibility: opencode
metadata:
  workflow: knowledge-maintenance
  depth: meta
---
## What I do
- Take a learning, correction, or observation from the current session
- Spawn a backprop subagent that searches existing skills for relevance
- The subagent edits the affected skills to incorporate the new knowledge
- Reports what changed and why

## When to use me
Trigger on:
- "backprop this" / "propagate this back"
- "this skill is wrong about X"
- "remember that X actually works like Y"
- "add this gotcha to the relevant skill"
- Any request to update skills based on something discovered during work

## How to invoke

The user provides a learning. It can be:
1. **A correction**: "ast-grep patterns don't work with JSX fragments unless you set language to tsx"
2. **A new pattern**: "found that combining `has` + `inside` with `stopBy: end` is the way to match deeply nested X inside Y"
3. **A gotcha/anti-pattern**: "never use `regex` on multiline nodes, it only sees the first line"
4. **A missing concept**: "the tree-sitter-queries skill doesn't cover the `set!` directive for injection.combined"

## Workflow

When this skill loads, the main agent MUST:

1. Collect the learning from the user's message (and any relevant context from the current conversation)
2. Spawn the `backprop` subagent with a prompt containing:
   - The exact learning/correction/observation
   - Which topic area it relates to (if obvious)
   - Any code examples or evidence from the session
3. The subagent handles everything else: searching skills, deciding edits, applying them
4. Report the subagent's summary back to the user

## Prompt template for the subagent

```
LEARNING:
{the observation, correction, or new pattern}

TOPIC HINT:
{topic area if known, or "unknown -- search broadly"}

EVIDENCE:
{any code snippets, error messages, or examples that support the learning}
```

The subagent will search `~/.agents/skills/`, read relevant skills, and edit them.

## What the subagent decides

For each relevant skill, the subagent picks one of:
- **append**: Add to an existing section (new example, new bullet point, new gotcha)
- **correct**: Fix incorrect information
- **restructure**: Move content between sections or add a new section
- **skip**: Skill is tangentially related but the learning doesn't belong there

The subagent does NOT:
- Create new skills (that's what docs-to-skills is for)
- Delete large sections
- Change skill frontmatter (name, description) unless the description is now inaccurate
