---
name: docs-to-skills
description: Research a topic via web, cluster concepts, and generate skill namespaces with usage examples
license: MIT
compatibility: opencode
metadata:
  audience: knowledge-engineers
  workflow: research-to-skill
---
## What I do
- Fetch documentation from URLs you provide
- Extract core patterns, anti-patterns, workflows
- Cluster related concepts into logical namespaces
- Generate SKILL.md files with frontmatter
- Output usage examples and expected agent behaviors
- Organize skills by topic hierarchy

## When to use me
Use this when you want to study a new domain and convert research into reusable skills. Trigger me with:
- A topic name (e.g., "graphql-api", "kubernetes-security", "event-driven-arch")
- URLs to research (docs, guides, RFCs, specs)
- Desired skill count (1-2 focused, 3-5 moderate, 5+ comprehensive)

## Workflow

### 1. Identify topic
```
I want to study [topic]. Research these docs:
- https://example.com/docs
- https://spec.example.org
Generate 3-5 skills with usage examples.
```

### 2. Fetch sources
- Call `webfetch` on each URL
- Extract patterns, anti-patterns, workflows
- Identify concept clusters (auth, pagination, error handling, etc.)

### 3. Cluster concepts
Group related concepts:
- **Core patterns**: Fundamental workflows
- **Edge cases**: Error handling, limits, failures
- **Integration**: Auth, tooling, ecosystem
- **Anti-patterns**: What to avoid

### 4. Generate skills
For each cluster, create:
```
.opencode/skills/<topic>-<cluster>/SKILL.md
```

Frontmatter:
```yaml
---
name: <topic>-<cluster>
description: <1-1024 chars, specific enough for agent selection>
license: MIT
compatibility: opencode
metadata:
  source: <url>
  depth: <intro|intermediate|advanced>
---
```

### 5. Output usage examples
Each skill includes:
- **When to use**: Trigger conditions
- **Example prompts**: How to invoke
- **Expected output**: What the agent should produce
- **Verification**: How to test the skill worked

## Example output structure

For topic "api-rate-limiting":

```
.opencode/skills/api-rate-limiting/SKILL.md
.opencode/skills/api-rate-limiting-strategies/SKILL.md
.opencode/skills/api-rate-limiting-headers/SKILL.md
```

### Usage example
```
skill({ name: "docs-to-skills" })
Topic: "graphql-subscriptions"
URLs: ["https://graphql.org/subscriptions", "https://apollo.dev/subscriptions"]
Count: 3
```

### Expected skill output
```yaml
---
name: graphql-subscriptions
description: Implement real-time data sync via GraphQL subscriptions with Apollo, Relay, and WebSocket patterns
---
## What I do
- Design subscription schemas
- Handle WebSocket lifecycle
- Implement connection management
- Handle reconnection strategies

## Example prompts
"Set up a subscription for new messages in the chat feature"
"Handle subscription cleanup on component unmount"

## Expected output
- Schema: `subscription { onMessageAdded: Message }`
- Resolver with AsyncIterator
- WebSocket auth via JWT in connectionParams
- Heartbeat interval: 30s
- Reconnection: exponential backoff 1s, 2s, 4s, 8s
```

## Concept clustering rules

### Cluster by:
1. **Functional layer**: Auth, data, transport, error
2. **User journey**: Setup, usage, debugging, optimization
3. **Failure mode**: Rate limits, timeouts, auth failures, data corruption
4. **Tooling**: CLI, SDK, dashboard, monitoring

### Naming convention
```
<topic>-<layer>
<topic>-<journey>
<topic>-<failure>
<topic>-<tooling>
```

Example:
- `kubernetes-auth`
- `kubernetes-deploy`
- `kubernetes-failures`
- `kubernetes-monitoring`

## Anti-patterns to flag
- Skills > 1024 chars description (too broad)
- Duplicate concept clusters (merge them)
- No usage examples (skill is unusable)
- No verification step (cannot confirm skill worked)

## Verification
After generating skills:
1. List all skill namespaces created
2. Show frontmatter for each
3. Display 1 usage example per skill
4. Confirm concept coverage (no gaps)
