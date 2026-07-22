---
name: load-session
description: Load saved session context from chat_log/ to resume work
---

# /load-session

Resume work from a saved session.

## Arguments
- (none), `0`, `latest`: Load most recent session
- `<number>`: Load Nth most recent (0-indexed)
- `<partial-filename>`: Load by name match

## Instructions

1. Determine file to load:
   - No arg/`0`/`latest`: Read `chat_log/LATEST.md` for filename
   - Number: List chat_log/ files, pick Nth by date
   - Partial name: Glob `chat_log/*<partial>*.md`

2. Read and internalize: Goal, Current State, Tasks, Open Questions, Context Files

3. Summarize and ask: "Ready to continue. What would you like to tackle first?"

## Examples

```
/skill:load-session                    # most recent
/skill:load-session 2                  # 3rd most recent
/skill:load-session vite-instrumentation  # by name
```
