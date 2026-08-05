# BRIEF: prevturn — regex battery for the previous-turn prose grader

You are the prevturn lane, cwd `~/projects/claude-research`. You own ONLY the
`prose-prod/` directory (its BRIEF-PREVTURN.md and node_modules included; do
not touch `slopstat/`, a sibling lane owns it). NO commits; the coordinator
reviews and commits. If reality deviates from this brief, STOP and report;
do not improvise.

## Context

`prose-prod/prose-prod.mjs` exists and works: it parses a markdown document
to an mdast tree (unified + remark-parse + remark-gfm, installed), grades
only `text` nodes (code exempt by node type), splits sentences with sbd, and
has a `--hook` leg reading Claude Code Stop-hook JSON from stdin (grades the
turn's text after the last real user entry in the transcript; exit 2 +
stderr = the model must rewrite). Read the whole file first; keep its
structure, exports, and CLI contract exactly.

## Task

Harden the rule battery and make the lexicon external.

1. LEXICON FILE: load `prose-prod/lexicon.json` at startup when present,
   shape:
   ```json
   { "decreed_stems": ["ground", "ruling", "honest", "distill"],
     "empirical_stems": ["..."], "phrases": ["..."] }
   ```
   A sibling lane generates the real one into `slopstat/lexicon.json`; your
   loader takes a path from env `PROSE_PROD_LEXICON` with the default
   `../slopstat/lexicon.json` relative to the script, falling back to the
   built-in decreed stems when the file is absent. Stems match as
   case-insensitive word prefixes with these guards: a stem hits
   `stem + (s|es|ed|ing|ly|ings)?` as a WHOLE word only. `ground` must hit
   grounded, grounding, re-grounded (hyphen prefixes count) and must NOT
   hit background, groundwork, underground, playground: keep an explicit
   allowlist of non-slop containing words per stem, extensible in the
   lexicon file as `"stem_allow": {"ground": ["background", ...]}`.
2. EXISTING RULES stay: em-dash, banned-word (provenance/substrate/
   load-bearing/regime), sycophancy, text-speak (u/ur), one-word-sentence,
   negative parallelism (both same-sentence and the cross-sentence pair
   rule).
3. NEW RULES:
   - `hedge-slop`: phrases "it's worth noting", "importantly", "notably",
     "in essence", "essentially", "robust", "comprehensive", "seamless",
     "leverage" (verb), "utilize", "delve".
   - `rhetorical-close`: final sentence of the turn matching
     "The bottom line", "At the end of the day", "Simply put".
   - `vague-quantity`: "several", "various", "numerous", "a number of"
     when followed by a plural noun (approximate with `\b(several|various|
     numerous|a number of)\s+\w+s\b`).
   Each rule: id, law line, test function, same finding shape as the
   existing rules.
4. TESTS: `prose-prod/test/grade.test.mjs` on `node --test`, zero new deps.
   Fixtures must include: every rule firing at least once; code fence and
   inline code containing violations that must NOT fire; a gfm table cell
   firing banned-word; `background music` NOT firing the ground stem;
   `re-grounded the plan` firing it; a clean document with abbreviations
   (Dr., e.g., fig. 2, v6/prolog paths inside backticks) producing zero
   findings. `node --test prose-prod/test/` green is the gate.
5. The extractor seam stays swappable: keep markdown-to-text-nodes behind
   one named function; a coming `extract query --lang md` door will replace
   its body. One comment line at that function naming the seam is allowed.

## Validation (paste verbatim in report)

```bash
node --test prose-prod/test/
printf 'The re-grounded ruling was honestly distilled.\n' | node prose-prod/prose-prod.mjs --text -
echo "exit=$?"   # must be 2 with four stem findings
printf 'Background music played.\n' | node prose-prod/prose-prod.mjs --text -
echo "exit=$?"   # must be 0
```

## Deliverable

REPORT-PREVTURN.md in prose-prod/: changes, verbatim validation output,
deviations ("None." only if literally true). Package manager: npm, and ONLY
inside prose-prod/ if a dep is truly needed (default: no new deps).

## Style laws

No em dashes. Banned words in prose and identifiers: provenance, substrate,
load-bearing, regime. Comments: only constraints the code cannot show, max 2
consecutive lines. Descriptive names.
