---
description: Load saved session context from chat_log/ to resume work
argument-hint: <filename or index>
allowed-tools: Read, Glob
---

# /load-session

Resume work from a saved session.

## Instructions

1. If `$ARGUMENTS` is provided:
   - If it's a filename, read `chat_log/$ARGUMENTS.md` directly
   - If it's a partial match, Glob `chat_log/*$ARGUMENTS*.md` to find it

2. If no argument:
   - Read `chat_log/LATEST.md` directly

3. Read the session file and internalize:
   - **Goal**: What we're working on
   - **Current State**: Where we left off
   - **Tasks**: What's remaining (focus on unchecked items)
   - **Open Questions**: Things to resolve

4. Summarize what you understood and ask: "Ready to continue. What would you like to tackle first?"

## Example
```
/load-session                    # loads most recent
/load-session 0                  # loads most recent
/load-session 2                  # loads 3rd most recent
/load-session vite-instrumentation  # loads matching file
```
