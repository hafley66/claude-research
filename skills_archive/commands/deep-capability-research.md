---
description: Research a tool, language, framework, or library into a reusable human/LLM capability reference
argument-hint: <target> [focus...]
---

# /deep-capability-research

Research `$ARGUMENTS` into a comprehensive Markdown reference that a human or LLM can use later without redoing the research.

## Output

Create or update a Markdown document in the current workspace. Name it from the target unless the user provides a path.

The document must include:

- Research date
- Target name, homepage, docs, repository, package/source links
- Current latest release or version, verified during the run
- Executive index of the target's core concepts
- Full docs/page inventory when available
- Capability matrix
- Syntax/API/reference sections with runnable examples
- Advanced use cases
- Patterns from official examples, blogs, third-party tutorials, and user discussions
- Changelog timeline, with recent major changes called out
- Open issues, closed issues, PRs, GitHub Discussions, and topic threads relevant to the focus
- Known limits, rough edges, and stale tutorial warnings
- Practical guidance for LLM generation and human usage
- Source links embedded near the facts they support

## Research Scope

Use current internet research unless the user explicitly says not to.

Cover, in order:

1. Official docs
2. Official docs source repository, if public
3. Main repository README, changelog, release notes, examples, tests, and source paths that define behavior
4. GitHub issues by relevant keyword searches
5. GitHub issue bodies and comments for high-signal issues
6. GitHub Discussions, if enabled
7. Pull request discussion or release-linked PRs for recent features
8. Official blog posts
9. Third-party tutorials, user blogs, docs integrations, generated-output projects, and course outlines
10. Reddit/HN/forum/community threads for friction, adoption patterns, and advanced usage

## Focus Handling

If the user provides focus words, make them first-class sections.

Examples:

- `animation`
- `grouping`
- `composition`
- `layers`
- `steps`
- `scenarios`
- `grids`
- `layouts`
- `model-view`
- `C4`
- `changelog`
- `issues`
- `advanced`

For every focus area, include:

- What exists now
- Exact syntax or API
- Export/runtime behavior
- Examples
- Known limitations
- Recent changes
- Open issues and discussion direction
- Advanced patterns users are trying

## GitHub Research Commands

When GitHub CLI is available, use it for current issue/release/discussion data.

Useful commands:

```shell
gh release list --repo OWNER/REPO --limit 20
gh issue list --repo OWNER/REPO --limit 100 --state open --json number,title,labels,createdAt,updatedAt,url
gh issue list --repo OWNER/REPO --search "KEYWORDS" --limit 100 --state all --json number,title,state,labels,createdAt,updatedAt,url
gh issue view NUMBER --repo OWNER/REPO --comments --json number,title,state,body,comments,url
gh pr view NUMBER --repo OWNER/REPO --comments --json number,title,state,body,comments,url,mergedAt
```

For Discussions:

```shell
gh api graphql -f query='query { repository(owner:"OWNER", name:"REPO") { discussions(first:20, orderBy:{field:UPDATED_AT, direction:DESC}) { nodes { number title url createdAt updatedAt category { name } comments(first:3) { totalCount nodes { body author { login } createdAt url } } } } } }'
```

Read deeper discussion bodies when relevant:

```shell
gh api graphql -f query='query { repository(owner:"OWNER", name:"REPO") { discussion(number:NUMBER) { number title url body createdAt updatedAt comments(first:30) { nodes { author { login } body createdAt url } } } } }'
```

## Source Handling

Prefer primary sources for exact behavior. Use third-party sources for usage patterns, examples, pain points, and stale-doc warnings.

When a third-party tutorial is old:

- Extract the usage pattern
- Mark stale feature claims explicitly
- Cross-check against current official docs/releases

For issue and discussion comments:

- Summarize the technical point
- Include issue or discussion URL
- Avoid long verbatim quotes
- Distinguish shipped behavior from proposed behavior

## Document Shape

Recommended top-level sections:

```markdown
# <Target> Capability Reference

## Research Metadata
## Executive Index
## Capability Matrix
## Official Docs Inventory
## Core Concepts
## <Focus Area 1>
## <Focus Area 2>
## Advanced Patterns
## External Tutorials And User Guidance
## GitHub Issue Discussion Notes
## GitHub Discussions Signals
## Recent Release Timeline
## Next Changelog Snapshot
## Known Limits And Pain Points
## LLM Usage Notes
## High-Value Examples
## Source Links
```

Use tables for dense factual material. Use code fences for examples. Keep exact dates on releases and issue/discussion timestamps when available.

## Verification

Before finishing:

- Check latest release from GitHub or official source
- Check current date in the document
- Check links are plausible and not stale redirects when possible
- Search the document for unsupported claims like "latest" without a dated source
- Search for duplicated sections or conflicting statements
- Search for stale source warnings where old third-party tutorials contradict current docs

## Final Response

Return only:

- Path to the Markdown file
- Brief coverage summary
- Any explicit research gaps that remain
