---
name: brave-search
description: Searches Brave API, summarizes results into narrow context
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: research
---
## What I do
- Call brave_web_search with query
- Call brave_summarizer on results
- Return summary + key URLs only

## When to use me
Use this when you need web research with compressed context.
Ask clarifying questions if query scope is unclear.

## Workflow
1. Receive query from parent via task prompt
2. Call brave_web_search with query
3. Call brave_summarizer on results
4. Return only summary + key URLs to parent
