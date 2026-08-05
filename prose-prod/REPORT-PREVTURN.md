# REPORT-PREVTURN

## What
Hardened the prose grader rule battery in `prose-prod/prose-prod.mjs` and made the lexicon external (`prose-prod/lexicon.json`), with a new `node --test` suite.

## Changes
- `prose-prod/prose-prod.mjs`
  - Lexicon loader: env `PROSE_PROD_LEXICON`, then default `../slopstat/lexicon.json`, then local `prose-prod/lexicon.json`, else built-in decreed stems (`ground, ruling, honest, distill`). Reads `decreed_stems`, `empirical_stems`, `phrases`, and `stem_allow`.
  - `decreed-stem` and `empirical-stem` rules via `buildStemRule`: stem matches as a whole-word prefix of `stem + (s|es|ed|ing|ly|ings)?`, hyphen prefixes split (`re-grounded` hits `ground`), and an allowlist per stem (`stem_allow`) blocks non-slop words.
  - New rules `hedge-slop`, `vague-quantity`; new `rhetorical-close` runs only on the turn's final sentence.
  - Existing rules kept: em-dash, banned-word, sycophancy, text-speak, one-word-sentence, neg-parallelism (same-sentence and cross-sentence pair).
  - Stem rules report one finding per matched stem; the report shows the stem per finding.
  - `textNodes` kept single seam with one comment line; CLI dispatch wrapped in an `isMain` guard so importing the module does not run the CLI.
- `prose-prod/lexicon.json`: decreed stems, empty empirical list, phrase list, and `stem_allow` for `ground` (background, groundwork, underground, playground, homeground, fairground, campground, foreground).
- `prose-prod/test/grade.test.mjs`: 8 tests, `node:test` only, no new deps.

## Validation

Verbatim (node v24.15.0):

```
$ node --test prose-prod/test/
node:internal/modules/cjs/loader:1479
  throw err;
  ^

Error: Cannot find module '/Users/chrishafley/projects/claude-research/prose-prod/test'
    at Module._resolveFilename (node:internal/modules/cjs/loader:1476:15)
    ...
✖ prose-prod/test (25.857333ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
```

```
$ node --test 'prose-prod/test/**/*.test.mjs'
✔ every per-sentence rule fires at least once
✔ rhetorical-close fires only on the final sentence
✔ a closer in the middle is not a rhetorical close
✔ decreed stems fire with the exact count
✔ ground allowlist words do not fire the ground stem
✔ code fences and inline code are exempt
✔ gfm table cell fires the banned-word rule
✔ clean document with abbreviations has zero findings
ℹ tests 8
ℹ suites 0
ℹ pass 8
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

```
$ printf 'The re-grounded ruling was honestly distilled.\n' | node prose-prod/prose-prod.mjs --text -
PROSE LAW VIOLATION (assistant turn):
  [decreed-stem] The re-grounded ruling was honestly distilled.
      law: Decreed slop words banned. (stem: ground)
  [decreed-stem] The re-grounded ruling was honestly distilled.
      law: Decreed slop words banned. (stem: ruling)
  [decreed-stem] The re-grounded ruling was honestly distilled.
      law: Decreed slop words banned. (stem: honest)
  [decreed-stem] The re-grounded ruling was honestly distilled.
      law: Decreed slop words banned. (stem: distill)
Fix: rewrite the flagged sentences and finish the turn again.
$ echo "exit=$?"   # => exit=2, four stem findings
```

```
$ printf 'Background music played.\n' | node prose-prod/prose-prod.mjs --text -
$ echo "exit=$?"   # => exit=0
```

## Gate status
- Semantic gates pass: `exit=2` with four stem findings; `exit=0` for background music.
- Test suite green: 8/8 via the working glob invocation.

## Deviations
Not None. The literal `node --test prose-prod/test/` does not run on this node version (v24.15.0). Node 24 treats a directory passed as a positional `--test` argument as a single module to load, attempting `require('.../prose-prod/test')` and failing with MODULE_NOT_FOUND; it does not scan the directory. The scan works only via no-arg (`node --test`, scans cwd) or an explicit glob (`node --test 'prose-prod/test/**/*.test.mjs'`), both verified green. The coordinator should either run the suite with the glob form or a node version that scans directory args.
