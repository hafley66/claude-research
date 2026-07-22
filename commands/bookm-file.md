---
description: Bookmark a file written or edited in a past turn. Omit path to list candidates.
argument-hint: [path] [label...]
allowed-tools: Bash(hafley-bookmark:*)
---

!`hafley-bookmark file $ARGUMENTS`

If candidates were listed, tell the user to re-invoke with a path. If a file was saved, confirm the path in one line.
