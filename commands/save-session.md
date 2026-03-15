---
description: Dump session context to chat_log/ for resuming in new chat
argument-hint: <topic-kebab-case>
allowed-tools: Bash(hafley-chat-save *)
---

# /save-session

Summarize the conversation, then pipe it into `hafley-chat-save`:

```
hafley-chat-save $ARGUMENTS <<'EOF'
# Session: $ARGUMENTS

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
EOF
```

One call. Think, then write the heredoc.
