---
name: github-features
description: GitHub platform features -- rulesets, CODEOWNERS, review policies, branch protection, Actions marketplace. Current as of March 2026.
version: 1
---

# GitHub Platform Features (as of March 2026)

## Code Review Policies

### CODEOWNERS
- `.github/CODEOWNERS` file, path-based reviewer auto-assignment
- `.gitignore`-style pattern matching
- Last matching pattern wins (not additive)
- Can enforce via branch protection "Require review from Code Owners"
- Limitations: no approval count variation, no backup reviewers, no overlapping scopes, no conditional logic, no cross-repo rules

### Required Reviewer Rule (Rulesets, GA Feb 2026)
- Path-based requirements with specific teams and configurable approval counts (0-10)
- `.gitignore`-style pattern matching with `!` negation
- Multiple overlapping rules are ALL enforced (unlike CODEOWNERS last-match-wins)
- Specific teams can be required per path
- Built into the ruleset system, not branch protection
- Source: https://github.blog/changelog/2026-02-17-required-reviewer-rule-is-now-generally-available/

### Required Review by Specific Teams (Rulesets, Nov 2025)
- Specify which teams must review changes to specific file paths
- Overlapping requirements: single file can require approvals from multiple teams
- Source: https://github.blog/changelog/2025-11-03-required-review-by-specific-teams-now-available-in-rulesets/

### Rulesets vs Branch Protection
- Rulesets are the successor to branch protection rules
- Rulesets support path-based reviewer requirements; branch protection does not
- Organizations on branch protection don't get the new required reviewer capabilities
- Rulesets can be org-wide; branch protection is per-repo

### What GitHub Still Cannot Do Natively
- Context-aware approval counts ("docs = 1 approval, backend = 2" based on content/metadata)
- Cross-repo policies from a single config location
- Conditional logic beyond path matching (PR size, labels, author-dependent rules)
- Dashboard/query layer across repos for review policy satisfaction

## Third-Party Review Tools

### PullApprove
- Path-based ownership + context-aware approval logic
- Varies approval requirements by PR size, labels, author, file types
- Backup reviewers, overlapping scopes
- Distinguishes documentation (1 approval) vs critical changes (2+ approvals)
- SaaS product
- Docs: https://5.pullapprove.com/docs/

### codeowners-plus (Open Source)
- Extends CODEOWNERS syntax with `min_reviews`, `max_reviews`, `unskippable_reviewers`
- GitHub: https://github.com/multimediallc/codeowners-plus

### GitHub Actions Marketplace
- Required Review action: matches file paths to reviewer arrays, blocks merge on missing approvals
- Codeowners Multi-Approval Check: extends CODEOWNERS with per-pattern approval counts
- Scattered ecosystem, no dominant solution

## Events API

### Repo Events Endpoint
- `GET /repos/{owner}/{repo}/events` -- paginated, supports etag/304
- `GET /orgs/{owner}/events` -- org-wide, one call instead of per-repo
- Respects `X-Poll-Interval` header

### Event Types Relevant to PR Sync
| Event | Contains PR number? | Notes |
|---|---|---|
| PullRequestEvent | yes (`payload.number`) | Opened, closed, merged, edited, review_requested |
| PullRequestReviewEvent | yes (`payload.pull_request.number`) | Review submitted |
| StatusEvent | no (has `payload.sha`) | CI status change, must match SHA to PR via `head_sha` |
| CheckRunEvent | no (has `payload.check_run.head_sha`) | GitHub Actions check completed |
| CheckSuiteEvent | no (has `payload.check_suite.head_sha`) | Suite of checks completed |
| PushEvent | no | Branch push, `payload.ref` has branch name |

### GraphQL PR Fields
Key fields available on PullRequest type:
- `statusCheckRollup.contexts` -- StatusContext (external CI) and CheckRun (Actions)
- `reviewRequests.nodes.requestedReviewer` -- User (login) or Team (slug)
- `reviews.nodes` -- submitted reviews with state (APPROVED, CHANGES_REQUESTED, COMMENTED)
- `labels.nodes` -- applied labels
- `commits(last:1).commit` -- latest commit for status checks

## Trigger
Trigger on: github rulesets, codeowners, github review policy, required reviewers, github events api, pullrequest event types, github branch protection, pullapprove, code review enforcement
