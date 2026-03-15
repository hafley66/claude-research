---
description: Dump session context to chat_log/ for resuming in new chat
argument-hint: <topic-kebab-case>
allowed-tools: Bash(./scripts/*), Read, Write
---

# /save-session

Save conversation context to markdown so you can resume in a fresh chat.

The script also updates `chat_log/LATEST.md` with the filename for quick `/load-session` access.

## Script Output
! `./scripts/new-chat-log.sh $ARGUMENTS`

## Instructions

Fill the created file with these sections by summarizing the conversation:

- **Goal**: What we're trying to accomplish
- **Current State**: Branch, what's working, key files
- **Problem/Context**: What issue we're solving
- **Solution/Approach**: Strategy decided on
- **Tasks**: Remaining work as `- [ ]` checklist
- **Files to Modify**: Key files involved
- **Key Insights**: Important decisions/learnings
- **Open Questions**: Unresolved items

Keep it scannable. Bullets over prose.

After writing the file, output `STATUS=OK` and repeat the "COPY AFTER COMPACT" line from the script output above.
