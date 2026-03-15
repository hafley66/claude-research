# Session: Hafley Plugin Setup

## Goal
- Create a Claude Code plugin called `hafley` to organize 34+ skills that were flat in `~/.claude/skills/`
- Back with git and push to private GitHub repo

## Current State
- **Branch**: `master`
- **Remote**: `github.com:hafley66/claude-research` (private)
- **Plugin**: installed as `hafley@hafley-marketplace` (local marketplace, user scope)
- **Old `~/.claude/skills/`**: emptied out, all content migrated to plugin

## Problem/Context
- All skills were flat in `~/.claude/skills/` with no grouping or namespacing
- User wanted plugin structure for organization
- Considered OpenCode compatibility but deferred -- plugin system is Claude Code specific
- User acknowledged they'd deal with OpenCode portability later

## Solution/Approach
- Created plugin at `/Users/chrishafley/projects/claude-research/`
- `.claude-plugin/plugin.json` + `marketplace.json` define the plugin
- All 34 SKILL.md files copied (symlinks resolved) into `skills/` subdirectories
- Registered local marketplace via `claude plugin marketplace add /Users/chrishafley/projects/claude-research`
- Installed plugin via `claude plugin install hafley@hafley-marketplace`
- Skills now namespaced as `hafley:*` (e.g., `hafley:ast-grep-patterns`)

## Tasks
- [ ] Verify `hafley:*` skills appear in next session
- [ ] Consider adding commands/ or agents/ to the plugin
- [ ] Consider statusline setup (researched options: claude-powerline, ccstatusline, ccusage)
- [ ] Future: OpenCode compatibility layer if needed

## Files to Modify
- `.claude-plugin/plugin.json` -- plugin metadata
- `.claude-plugin/marketplace.json` -- marketplace manifest
- `skills/*/SKILL.md` -- 34 skill definitions

## Key Insights
- `plugin marketplace add .` fails, needs absolute path or `./`-prefixed relative
- Symlinked skills (book-*) were resolved with `cp -L` during migration
- Old `~/.claude/skills/` had its own git history (6 commits) -- not preserved, content is canonical in new repo
- Local marketplace install is purely local, nothing goes public

## Open Questions
- Will duplicate skill names between plugin and any future global skills cause conflicts?
- Should the plugin be published to GitHub marketplace for multi-machine sync, or keep local?

## Skill Families in Plugin
- **ast-grep**: patterns, cli, rules, transforms, api (5)
- **typespec**: core, cross-layer, custom-emitters, emitter-framework, emitters, enums, input-output, rest, templates, tooling, validation (11)
- **tree-sitter**: core, grammars, queries (3)
- **deep-research**: core, cluster, fetch, output (4)
- **book**: assessment, crosslink, supplements, typography (4)
- **alloy**: core, languages (2)
- **standalone**: api-design, backprop, brave-search, docs-to-skills, rust-history-book (5)
