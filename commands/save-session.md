---
description: Dump session context to chat_log/ for resuming in new chat
argument-hint: <topic-kebab-case>
allowed-tools: Bash(hafley-chat-save *)
---

# /save-session

Summarize the conversation into a session file.

## Instructions

1. If `$ARGUMENTS` is empty, infer a kebab-case topic from the conversation (e.g. `hafley-alloy-rust-layers-0-1`)
  - if its just yolo'd into the middle of stuff, then just read this and figure it out.
2. Summarize the conversation, then pipe it into `hafley-chat-save <topic>`:
3. If i ask you to zoom 3, it means i want you to run zoom logic:
```
### Level 3

Logic filled in. All the level 2 skeleton with the gaps completed as pseudo code. Still uses `// ...` for truly boring parts (serialization boilerplate, etc.) but the interesting logic is written out. One step from real.
```

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
## Turn-by-turn Attribution Summary:
<...(LLM|User): <describe turn in 1 sentence of what user or bot says. this is a compression of chat.>>
EOF
```

The first positional argument to `hafley-chat-save` is REQUIRED. Always pass the topic as the first arg before the heredoc.

One call. Think, then write the heredoc.
