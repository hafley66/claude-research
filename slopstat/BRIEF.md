# BRIEF: slopstat — measure the AI-slop signal from real session logs

You are the slopstat lane, cwd `~/projects/claude-research`. You own ONLY the
`slopstat/` directory. NO commits; the coordinator reviews and commits. If
reality deviates from this brief, STOP and report; do not improvise.

## Task

Chris wants an empirical banned-word lexicon: words and phrases the assistant
uses at a far higher rate than Chris himself does in the same sessions.
Current known offenders, decreed by Chris and seeded regardless of stats:
stems `ground` (grounded/grounding/re-ground), `ruling`, `honest`,
`distill`. The tool must find the REST of the list from data and keep
finding it as logs grow.

## Data

Claude Code transcripts: `~/.claude/projects/*/*.jsonl` (one line = one JSON
entry). Read-only; never modify or move them.

- Assistant corpus: entries with `.type == "assistant"`, text =
  `.message.content[] | select(.type=="text") | .text`.
- User corpus: entries with `.type == "user"` where `.message.content` is a
  plain string, or an array containing a `text` block. EXCLUDE from the user
  corpus any text block whose content starts with `<` and contains
  `system-reminder`, `command-name`, `local-command`, or `task-notification`
  (those are harness-injected, they are not Chris typing). Tool results are
  never user text.
- Strip markdown code before counting: drop fenced blocks (``` to ```) and
  inline backtick spans with a small tokenizer; the point is prose rates,
  and regex-stripping fences is acceptable HERE (stats tool, not a grader).

## Stats

- Tokenize to lowercase word stems: strip possessives and the suffixes
  s/es/ed/ing/ly when the stem stays >= 4 chars (crude stemming is fine,
  note it in the report).
- Also count 2-grams and 3-grams over the prose.
- For each stem/n-gram with assistant count >= 20: rate per 10k words in
  each corpus, ratio = (assistant_rate + s) / (user_rate + s) with
  smoothing s = 0.5.
- Rank by ratio * log(assistant_count). Top 150 into the report table with
  columns: rank | stem or phrase | assistant count | assistant rate |
  user rate | ratio.
- Also report the reverse top 30 (Chris-heavy, assistant-light) as a sanity
  check that the signal separates the two voices.

## Deliverables (all inside slopstat/)

1. `slopstat.mjs` — node >= 20, ZERO npm dependencies (node:fs, node:path
   only), re-runnable: `node slopstat/slopstat.mjs` writes the other two
   files. Deterministic output ordering.
2. `lexicon.json` — the machine contract other tools consume:
   ```json
   {
     "generated": "<iso date>",
     "decreed_stems": ["ground", "ruling", "honest", "distill"],
     "empirical_stems": ["..."],
     "phrases": ["..."]
   }
   ```
   Empirical entries: ratio >= 8 AND assistant count >= 30, excluding
   ordinary function words and anything in the reverse (Chris-heavy) list.
   Phrases: the qualifying 2/3-grams.
3. `REPORT-SLOPSTAT.md` — corpus sizes (sessions, entries, words per side),
   the two ranked tables, the threshold receipts, and a caveats section
   (stemming crudeness, retention window truncating history, harness-text
   contamination risks and how you excluded it).

## Validation

Run the script twice; byte-identical outputs both runs. Paste corpus-size
numbers and the top-20 rows verbatim into the report.

## Style laws

No em dashes. Banned words in prose and identifiers: provenance, substrate,
load-bearing, regime. Comments state only constraints the code cannot show,
max 2 consecutive lines. Descriptive variable names, never single letters.
