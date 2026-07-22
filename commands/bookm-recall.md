---
description: Load a saved bookmark back into the current conversation as context
argument-hint: <idx-or-label>
allowed-tools: Bash(hafley-bookmark:*)
---

!`hafley-bookmark show $ARGUMENTS`

Treat the content above as a prior-conversation snippet the user wants to continue from. Read it silently, then ask what they want to do next. Do not repeat the snippet verbatim.
