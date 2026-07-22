---
name: deep-research-output
description: Presents deep research findings in structured format — exec summary, architecture decisions, code patterns, warnings
license: MIT
compatibility: opencode
metadata:
  workflow: structured-presentation
---
## What I do
- Transform clustered findings into actionable output
- Executive summary: 2-3 sentence core finding
- Architecture patterns: copy-pasteable implementations
- Anti-patterns: explicit warnings to avoid
- Source bibliography: primary vs secondary

## Output template

```
## Executive Summary
<2-3 sentences capturing the core architectural finding>

## Architecture Patterns

### <Layer name> (e.g., Authentication)
- **Pattern**: <name>
  - Implementation: <description or code>
  - Source: <URL>
  - Confidence: high/medium/low (based on source agreement)

### <Layer name> (e.g., Rate Limiting)
- **Pattern**: <name>
  - Implementation: <description>
  - Headers: <X-RateLimit-Limit, etc>
  - Source: <URL>

## Anti-Patterns / Warnings
- **Avoid**: <pattern>
  - Reason: <why they avoid it>
  - Source: <URL>
- **Pitfall**: <common mistake>
  - Mitigation: <how to avoid>

## Code Patterns (if available)
```
<copy-pasteable implementation>
```

## Sources
### Primary
- Engineering blog: <URL>
- API docs: <URL>
- Security docs: <URL>

### Secondary
- Talks/interviews: <URL>
- GitHub repos: <URL>

## Timeline (if tracked)
- <date>: <change>
- <date>: <deprecation>
```

## Verification checklist
- Min 3 distinct sources cited
- Pattern coverage: auth, data, transport, error
- Anti-patterns explicitly flagged
- Actionable: copy-pasteable patterns provided
