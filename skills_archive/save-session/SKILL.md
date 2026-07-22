---
name: save-session
description: Dump session context to chat_log/ for resuming in new chat
---

# /save-session

Summarize the conversation into a session file.

## Arguments
- (none): Infer topic from conversation
- `<topic-kebab-case>`: Use provided topic

## Instructions

1. Determine topic from argument or infer from conversation
2. Run: `hafley-chat-save <topic> <<'EOF'` with the structured summary:

```
# Session: <topic>

## Goal
...
## Current State
...
## Problem/Context
...
## Solution/Approach
...
## Tasks
- [ ] ...
## Files to Modify
...
## Key Insights
...
## Open Questions
...
## Context Files
...
EOF
```

The topic is REQUIRED as the first positional argument.
