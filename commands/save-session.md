---
description: Dump session context to chat_log/ for resuming in new chat
argument-hint: <topic-kebab-case>
allowed-tools: Bash(hafley-chat-save *)
---

# /save-session

Summarize the conversation into a session file.

## Instructions

1. If `$ARGUMENTS` is empty, infer a kebab-case topic from the conversation (e.g. `hafley-alloy-rust-layers-0-1`)
2. Summarize the conversation, then pipe it into `hafley-chat-save <topic>`:

```
hafley-chat-save <topic> <<'EOF'
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
<list file paths already read this session that would be useful to re-read when resuming -- only include files relevant to unfinished work>
EOF
```

The first positional argument to `hafley-chat-save` is REQUIRED. Always pass the topic as the first arg before the heredoc.

One call. Think, then write the heredoc.
