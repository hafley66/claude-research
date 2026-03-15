---
name: deep-research-fetch
description: Wraps Brave Search MCP for keyword-based web search + AI summarization in deep research workflows
license: MIT
compatibility: opencode
metadata:
  workflow: search-fetch-summarize
---
## What I do
- Execute brave_web_search with targeted keywords
- Call brave_summarizer on results for AI-generated summaries
- Extract: patterns, source URLs, code snippets, warnings
- Return structured findings for aggregation

## When to use me
Use this as a subagent in deep-research orchestrations for parallel source gathering.

## Search strategy

### Keyword construction
For company research:
- "<company> <topic> implementation"
- "<company> <topic> engineering blog"
- "<company> <topic> API docs"
- "<company> <topic> security architecture"

### Search parameters
- freshness: "pm" (past month) for recent info, "py" for historical
- count: 20 for comprehensive coverage
- summary: true to enable brave_summarizer

### Summarizer workflow
1. brave_web_search with summary: true
2. Extract summary_key from response
3. brave_summarizer with summary_key
4. Parse: entity_info, inline_references

## Output format
```
## Findings
<summarized content>

## Sources
- <URL 1>
- <URL 2>

## Patterns identified
- <pattern 1>
- <pattern 2>

## Code snippets (if available)
<code block>
```

## Example usage
"Use deep-research-fetch to search 'stripe idempotency key implementation'"
