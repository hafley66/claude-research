---
name: deep-research
description: Orchestrates multi-source deep research via Brave Search MCP with subagent parallelization, synthesis, and structured output
license: MIT
compatibility: opencode
metadata:
  audience: researchers
  workflow: deep-company-research
---
## What I do
- Execute parallel Brave Search queries for comprehensive coverage
- Synthesize findings across multiple sources
- Identify patterns, anti-patterns, and architecture decisions
- Present structured output: exec summary, code patterns, warnings, sources

## When to use me
Use this for frontier company research, tech stack analysis, or competitive architecture comparison. Trigger with:
- "Research how X company does Y"
- "Deep research: X's architecture for Y"
- "Compare X vs Y on Z"

## Workflow

### 1. Parallel searches
For "how X company does Y", run 4 searches in parallel:
```
brave_web_search "X company Y implementation"
brave_web_search "X company Y engineering blog"
brave_web_search "X company Y API docs"
brave_web_search "X company Y security architecture"
```

### 2. Summarize each
Call brave_summarizer on each search result:
- Extract key patterns
- Identify source URLs
- Flag anti-patterns

### 3. Synthesize
Merge findings:
- Converged patterns (multiple sources agree)
- Divergence (sources disagree - flag for user)
- Anti-patterns (what X explicitly avoids)

### 4. Output structure
```
## Executive Summary
<2-3 sentence core finding>

## Architecture Patterns
- **Pattern**: <name>
  - Implementation: <description>
  - Source: <URL>
  - Code: <if available>

## Anti-Patterns / Warnings
- **Avoid**: <pattern>
  - Reason: <why>

## Sources
- Primary: engineering blog, API docs
- Secondary: talks, GitHub
```

## Verification
After research:
1. Min 3 distinct sources cited
2. Pattern coverage: auth, data, transport, error
3. Anti-patterns flagged
4. Actionable: copy-pasteable patterns
