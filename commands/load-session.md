---
description: Load saved session context from chat_log/ to resume work
argument-hint: <filename or index>
allowed-tools: Read, Glob
---

# /load-session

Resume work from a saved session.

## Available Sessions
! `ls -t chat_log/*.md | grep -v LATEST.md | head -10`

## Instructions

1. If `$ARGUMENTS` is provided:
   - If it's a number, load the Nth most recent file (excluding LATEST.md)
   - If it's a filename, load that file from `chat_log/`
   - If it's a partial match, find the best match

2. If no argument:
   - Read `chat_log/LATEST.md` to get the filename of the most recent session
   - Then load that file

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
