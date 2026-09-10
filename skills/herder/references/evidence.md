# Evidence

Session `01a07c48-4ca3-75c3-9fdb-17c4c4ca1c58` (boop `dict_session.id` 5826), 537 user
turns. Mined with `boop db` over `agent_turn` where `role_id=1` (user), joined to
`dict_session` and `dict_role`. Assistant and tool turns and worker notification messages
(said beginning `[boop m-...`) were excluded.

## Explicit (user said it)

| turns | user wording, condensed | rule |
| --- | --- | --- |
| 6052, 6060, 6063 | wield glm5.3flash on the z.ai plan, fall back to opencode via boop, save the expensive primary; "flash's are katanas"; do not let them drag on context size | route workers off the primary, bound their context |
| 6857 | make `f41` (deepseek flash4.1) a boop preset, keep it default | f41 is the default worker |
| 6982, 6998, 7600, 7784 | spin katanas; spam ds41f and opus5 | parallel workers on cheap models |
| 7597 | primary is the auditor and pilot, should not do too much code | primary coordinates and reviews |
| 7765 | use boop for even Codex | every worker dispatch goes through boop |
| 7989 | use non-Codex models so I do not lose you | preserve Codex plan usage |
| 6083 | dispatch bounded jobs through Boop, keep the mailbox wait armed, handle completion messages, stop on verified delivery or a concrete blocker | bounded jobs, completion owned by parent |
| 1047, 2559, 3546 | commit often; commit as you go for refactor and still green | scoped green commits along the way |
| 5618 | commit as the unit of measure | one unit per commit |
| 5400 | commit your work as you go for only your stuff | stage only owned files |
| 4393, 4412 | yield a next message to explain current state | yield instead of guessing |
| 7309 | keep the file layout tight, least noisy, colocated | minimal footprint |
| 7805, 8007 | do not spend giant SVG and HTML tokens; automated visuals so sitreps do not burn tokens | keep artifacts out of coordinator context |
| 8015 | minimum tokens; delegate katanas to a sol-low coordinator is fine | extra coordinator only if needed |
| 8018 | asked for this coordinator/herder skill | skill intent |
| 7307 | motivate workers, positive framing | worker tone guidance |

## Inferred (not stated verbatim)

- "No model-tier escalation by default" combines turn 8015 (sub-coordinator allowed only if
  needed) with repeated cost complaints; escalation was not banned outright.
- "Even Codex workers go through Boop" generalizes turn 7765 past its one example.
- "Read parent replies at checkpoints" follows from turn 6080 (boop wait is mid, lanes push
  messages) plus turn 6083 (keep the mailbox wait armed).
- "Delivery-state ladder" is assembled from turns 6083 and 7784; the user named the
  distinction, the five rungs are this skill's framing.

## Superseded or scoped

- Turn 528 dispatched a native subagent sol reporting to the parent directly. Later turns
  7765 and 7989 route workers through boop and prefer non-Codex. Turn 528 is superseded for
  worker dispatch.
- Turn 8015 permits an extra cheap coordinator. Keep it off by default; treat as exception.
- Worker notification bodies appeared among user-role turns and were excluded from mining.

## Discovery and reload (read-only)

Claude Code:

- Live skills root: `/Users/chrishafley/projects/claude-research/skills/<name>/SKILL.md`.
- Marketplace `hafley-marketplace`, source directory `/Users/chrishafley/projects/claude-research`
  (`.claude-plugin/marketplace.json`, plugin `i`), enabled in `~/.claude/settings.json` as
  `i@hafley-marketplace`.
- `~/.claude/skills -> ~/.agents/skills` is a separate root (holds cate-theme, local-npm-registry).
- Cache copy at `~/.claude/plugins/cache/hafley-marketplace/i/0.1.1` is stale (two skills);
  the live directory is what discovery reads.
- Reload commands seen in the repo and CLI: `bin/reinstall-plugin` (wraps
  `claude plugin install i@hafley-marketplace`) and `claude plugin update i@hafley-marketplace`.
  Both require a restart to apply. A new session otherwise picks up the live directory.

Codex:

- Marketplace `personal`, root `/Users/chrishafley`, catalog
  `/Users/chrishafley/.agents/plugins/marketplace.json`.
- Plugin `claude-research-toolkit@personal`, source `/Users/chrishafley/plugins/claude-research-toolkit`
  (a copy with ~70 skills, frozen 2026-07-15, separate from the live repo).
- Installed cache `~/.codex/plugins/cache/personal/claude-research-toolkit/0.1.0` is stale.
- Live per-skill root `~/.codex/skills`; existing symlinks `local-npm-registry` and
  `sqlite-ivm-vtab-lifecycle` point into `claude-research/skills`.
- The repo also carries `.codex/skills -> ../skills` for project-local use.
- To expose this skill: symlink `~/.codex/skills/herder -> /Users/chrishafley/projects/claude-research/skills/herder`,
  matching the established pattern, or sync the plugin copy and run
  `codex plugin add claude-research-toolkit@personal`.

This lane did not modify `~/.claude` or `~/.codex`. Integration and reload are the parent's.
