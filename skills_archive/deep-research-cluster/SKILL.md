---
name: deep-research-cluster
description: Clusters findings from deep research into themes — patterns, anti-patterns, architecture layers, timelines
license: MIT
compatibility: opencode
metadata:
  workflow: finding-clustering
---
## What I do
- Merge findings from multiple subagents
- Cluster by functional layer (auth, data, transport, error)
- Identify pattern convergence across sources
- Flag anti-patterns and explicit warnings
- Timeline tracking: evolution of approach over time

## Clustering rules

### By functional layer
- **Auth**: token formats, session management, OAuth flows
- **Data**: storage choices, caching, consistency models
- **Transport**: API design, pagination, rate limiting
- **Error**: error codes, retry strategies, idempotency

### By pattern type
- **Core patterns**: fundamental approaches used consistently
- **Edge cases**: error handling, limits, failures
- **Anti-patterns**: what companies explicitly avoid

### By timeline
- Track evolution: "X used Y until 2023, now uses Z"
- Identify deprecation warnings
- Flag sunset dates for old approaches

## Output structure
```
## Pattern Clusters
### Auth layer
- Converged pattern: <description>
  - Sources: 3 agreements
- Divergence: <where sources disagree>

### Anti-patterns
- X explicitly avoids: <pattern>
- Common pitfall: <description>

### Timeline
- 2022: used Y
- 2023: migrated to Z
- 2024: deprecated Y entirely
```

## Example usage
"Cluster findings from deep-research on Anthropic auth"
