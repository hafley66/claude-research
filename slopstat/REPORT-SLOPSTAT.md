# Report: slopstat

Script: `node slopstat/slopstat.mjs` (re-runnable, deterministic). Set `SLOPSTAT_ROOT` to point at a different corpus root.

## Corpus sizes

| session files | 215 |
| assistant entries | 11631 |
| user entries | 4595 |
| assistant words | 1069169 (73.8%) |
| user words | 379303 (26.2%) |

Rates are per 10k words of that side's prose. Ratio = (assistant_rate + s) / (user_rate + s), s = 0.5.
Rank score = ratio * ln(assistant_count). Table capped at top 150.

## Top 150 (assistant-heavy)

| rank | stem or phrase | count | assistant rate | user rate | ratio |
| --- | --- | --- | --- | --- | --- |
| 1 | two | 3711 | 34.71 | 7.04 | 4.7 |
| 2 | is exactly | 455 | 4.26 | 0.26 | 6.2 |
| 3 | today | 929 | 8.69 | 1.19 | 5.4 |
| 4 | three | 1957 | 18.30 | 3.53 | 4.7 |
| 5 | exactly the | 393 | 3.68 | 0.21 | 5.9 |
| 6 | the one | 893 | 8.35 | 1.29 | 4.9 |
| 7 | the two | 889 | 8.31 | 1.29 | 4.9 |
| 8 | four | 868 | 8.12 | 1.29 | 4.8 |
| 9 | already | 3018 | 28.23 | 6.85 | 3.9 |
| 10 | me check | 249 | 2.33 | 0.00 | 5.7 |
| 11 | let me check | 249 | 2.33 | 0.00 | 5.7 |
| 12 | land | 2843 | 26.59 | 6.67 | 3.8 |
| 13 | it lands | 256 | 2.39 | 0.05 | 5.2 |
| 14 | worth | 487 | 4.55 | 0.58 | 4.7 |
| 15 | a real | 640 | 5.99 | 0.98 | 4.4 |
| 16 | mb | 1007 | 9.42 | 1.95 | 4.0 |
| 17 | becom | 478 | 4.47 | 0.61 | 4.5 |
| 18 | plus | 1045 | 9.77 | 2.08 | 4.0 |
| 19 | is already | 362 | 3.39 | 0.34 | 4.6 |
| 20 | the real | 811 | 7.59 | 1.50 | 4.0 |
| 21 | receipt | 989 | 9.25 | 2.08 | 3.8 |
| 22 | v s | 425 | 3.98 | 0.55 | 4.2 |
| 23 | me read | 203 | 1.90 | 0.00 | 4.8 |
| 24 | let me read | 203 | 1.90 | 0.00 | 4.8 |
| 25 | the three | 351 | 3.28 | 0.42 | 4.1 |
| 26 | precise | 261 | 2.44 | 0.18 | 4.3 |
| 27 | against | 1143 | 10.69 | 2.87 | 3.3 |
| 28 | me confirm | 180 | 1.68 | 0.00 | 4.4 |
| 29 | let me confirm | 180 | 1.68 | 0.00 | 4.4 |
| 30 | still running | 359 | 3.36 | 0.50 | 3.9 |
| 31 | machinery | 266 | 2.49 | 0.24 | 4.1 |
| 32 | honest | 701 | 6.56 | 1.58 | 3.4 |
| 33 | you already | 195 | 1.82 | 0.05 | 4.2 |
| 34 | green | 1661 | 15.54 | 4.88 | 3.0 |
| 35 | ruling | 811 | 7.59 | 1.95 | 3.3 |
| 36 | the honest | 222 | 2.08 | 0.13 | 4.1 |
| 37 | the agent | 444 | 4.15 | 0.79 | 3.6 |
| 38 | plus the | 302 | 2.82 | 0.37 | 3.8 |
| 39 | hold | 933 | 8.73 | 2.40 | 3.2 |
| 40 | isn | 494 | 4.62 | 0.98 | 3.5 |
| 41 | the fix | 332 | 3.11 | 0.47 | 3.7 |
| 42 | nobody | 169 | 1.58 | 0.00 | 4.2 |
| 43 | the store | 321 | 3.00 | 0.45 | 3.7 |
| 44 | against the | 423 | 3.96 | 0.76 | 3.5 |
| 45 | waiting on | 205 | 1.92 | 0.11 | 4.0 |
| 46 | one | 7671 | 71.75 | 30.11 | 2.4 |
| 47 | you asked | 166 | 1.55 | 0.00 | 4.1 |
| 48 | five | 337 | 3.15 | 0.53 | 3.6 |
| 49 | reading the | 286 | 2.67 | 0.37 | 3.7 |
| 50 | zero | 1308 | 12.23 | 3.93 | 2.9 |
| 51 | your word | 181 | 1.69 | 0.05 | 4.0 |
| 52 | your call | 172 | 1.61 | 0.03 | 4.0 |
| 53 | when it lands | 172 | 1.61 | 0.03 | 4.0 |
| 54 | s | 2659 | 24.87 | 9.25 | 2.6 |
| 55 | clos | 491 | 4.59 | 1.05 | 3.3 |
| 56 | exact | 2353 | 22.01 | 8.12 | 2.6 |
| 57 | rather than | 673 | 6.29 | 1.69 | 3.1 |
| 58 | clean | 1585 | 14.82 | 5.11 | 2.7 |
| 59 | two things | 202 | 1.89 | 0.13 | 3.8 |
| 60 | suite | 756 | 7.07 | 2.03 | 3.0 |
| 61 | instead of | 882 | 8.25 | 2.53 | 2.9 |
| 62 | all three | 317 | 2.96 | 0.53 | 3.4 |
| 63 | stor | 300 | 2.81 | 0.47 | 3.4 |
| 64 | rather | 723 | 6.76 | 1.98 | 2.9 |
| 65 | is still | 329 | 3.08 | 0.58 | 3.3 |
| 66 | me read the | 151 | 1.41 | 0.00 | 3.8 |
| 67 | doesn | 603 | 5.64 | 1.56 | 3.0 |
| 68 | row | 1816 | 16.99 | 6.49 | 2.5 |
| 69 | merg | 1244 | 11.64 | 4.11 | 2.6 |
| 70 | everything else | 196 | 1.83 | 0.16 | 3.5 |
| 71 | is one | 318 | 2.97 | 0.58 | 3.2 |
| 72 | delta | 717 | 6.71 | 2.06 | 2.8 |
| 73 | the oracle | 225 | 2.10 | 0.26 | 3.4 |
| 74 | checking the | 143 | 1.34 | 0.00 | 3.7 |
| 75 | surviv | 320 | 2.99 | 0.61 | 3.2 |
| 76 | cascade | 643 | 6.01 | 1.82 | 2.8 |
| 77 | audit | 635 | 5.94 | 1.79 | 2.8 |
| 78 | gap | 627 | 5.86 | 1.77 | 2.8 |
| 79 | independent | 431 | 4.03 | 1.03 | 3.0 |
| 80 | genuine | 459 | 4.29 | 1.13 | 2.9 |
| 81 | seam | 750 | 7.01 | 2.27 | 2.7 |
| 82 | live | 1818 | 17.00 | 6.83 | 2.4 |
| 83 | answer | 1291 | 12.07 | 4.59 | 2.5 |
| 84 | gb | 382 | 3.57 | 0.87 | 3.0 |
| 85 | compil | 430 | 4.02 | 1.05 | 2.9 |
| 86 | fix is | 192 | 1.80 | 0.18 | 3.4 |
| 87 | the live | 244 | 2.28 | 0.37 | 3.2 |
| 88 | free | 674 | 6.30 | 2.03 | 2.7 |
| 89 | you right | 160 | 1.50 | 0.08 | 3.4 |
| 90 | stay | 1144 | 10.70 | 4.06 | 2.5 |
| 91 | spell | 373 | 3.49 | 0.87 | 2.9 |
| 92 | fixpoint | 565 | 5.28 | 1.63 | 2.7 |
| 93 | small | 492 | 4.60 | 1.34 | 2.8 |
| 94 | construct | 272 | 2.54 | 0.50 | 3.0 |
| 95 | runn | 1806 | 16.89 | 7.17 | 2.3 |
| 96 | is exactly the | 177 | 1.66 | 0.16 | 3.3 |
| 97 | the rest | 184 | 1.72 | 0.18 | 3.2 |
| 98 | instinct | 154 | 1.44 | 0.08 | 3.4 |
| 99 | bound | 568 | 5.31 | 1.69 | 2.7 |
| 100 | still | 2124 | 19.87 | 8.78 | 2.2 |
| 101 | committing the | 130 | 1.22 | 0.00 | 3.4 |
| 102 | committ | 1227 | 11.48 | 4.61 | 2.3 |
| 103 | rows | 2018 | 18.87 | 8.36 | 2.2 |
| 104 | retract | 400 | 3.74 | 1.03 | 2.8 |
| 105 | running the | 265 | 2.48 | 0.50 | 3.0 |
| 106 | a second | 173 | 1.62 | 0.16 | 3.2 |
| 107 | verdict | 565 | 5.28 | 1.71 | 2.6 |
| 108 | is real | 157 | 1.47 | 0.11 | 3.3 |
| 109 | the tick | 269 | 2.52 | 0.53 | 2.9 |
| 110 | gets | 542 | 5.07 | 1.63 | 2.6 |
| 111 | real | 2985 | 27.92 | 13.37 | 2.0 |
| 112 | record | 712 | 6.66 | 2.37 | 2.5 |
| 113 | noth | 1588 | 14.85 | 6.43 | 2.2 |
| 114 | first the | 133 | 1.24 | 0.03 | 3.3 |
| 115 | owns | 245 | 2.29 | 0.45 | 2.9 |
| 116 | column | 1395 | 13.05 | 5.64 | 2.2 |
| 117 | proven | 346 | 3.24 | 0.87 | 2.7 |
| 118 | ms | 741 | 6.93 | 2.58 | 2.4 |
| 119 | cycle | 280 | 2.62 | 0.61 | 2.8 |
| 120 | identical | 733 | 6.86 | 2.56 | 2.4 |
| 121 | salt | 165 | 1.54 | 0.16 | 3.1 |
| 122 | the build | 144 | 1.35 | 0.08 | 3.2 |
| 123 | the v | 432 | 4.04 | 1.24 | 2.6 |
| 124 | gone | 292 | 2.73 | 0.66 | 2.8 |
| 125 | mint | 237 | 2.22 | 0.45 | 2.9 |
| 126 | untouch | 243 | 2.27 | 0.47 | 2.8 |
| 127 | scc | 370 | 3.46 | 1.00 | 2.6 |
| 128 | the moment | 134 | 1.25 | 0.05 | 3.2 |
| 129 | cell | 299 | 2.80 | 0.71 | 2.7 |
| 130 | ride | 228 | 2.13 | 0.42 | 2.9 |
| 131 | surface | 806 | 7.54 | 2.98 | 2.3 |
| 132 | confirm | 1148 | 10.74 | 4.64 | 2.2 |
| 133 | disjoint | 186 | 1.74 | 0.26 | 2.9 |
| 134 | the word and | 132 | 1.23 | 0.05 | 3.1 |
| 135 | dd | 531 | 4.97 | 1.74 | 2.4 |
| 136 | fresh | 405 | 3.79 | 1.19 | 2.5 |
| 137 | sitt | 145 | 1.36 | 0.11 | 3.1 |
| 138 | the engine | 546 | 5.11 | 1.82 | 2.4 |
| 139 | one line | 198 | 1.85 | 0.32 | 2.9 |
| 140 | mechanism | 340 | 3.18 | 0.92 | 2.6 |
| 141 | tick | 2641 | 24.70 | 12.68 | 1.9 |
| 142 | join | 1160 | 10.85 | 4.82 | 2.1 |
| 143 | lives in | 182 | 1.70 | 0.26 | 2.9 |
| 144 | aren | 129 | 1.21 | 0.05 | 3.1 |
| 145 | arc | 862 | 8.06 | 3.37 | 2.2 |
| 146 | recompute | 257 | 2.40 | 0.58 | 2.7 |
| 147 | cost | 807 | 7.55 | 3.11 | 2.2 |
| 148 | port | 900 | 8.42 | 3.59 | 2.2 |
| 149 | phase | 672 | 6.29 | 2.48 | 2.3 |
| 150 | probe | 285 | 2.67 | 0.71 | 2.6 |

## Reverse top 30 (Chris-heavy sanity check)

| rank | stem | user count | assistant rate | user rate | ratio |
| --- | --- | --- | --- | --- | --- |
| 1 | fuck | 1329 | 0.19 | 35.04 | 0.0 |
| 2 | dont | 594 | 0.03 | 15.66 | 0.0 |
| 3 | u | 1069 | 0.67 | 28.18 | 0.0 |
| 4 | conversation | 614 | 0.22 | 16.19 | 0.0 |
| 5 | interrupt | 633 | 0.28 | 16.69 | 0.0 |
| 6 | im | 414 | 0.02 | 10.91 | 0.0 |
| 7 | please | 385 | 0.04 | 10.15 | 0.1 |
| 8 | chrishafley | 327 | 0.02 | 8.62 | 0.1 |
| 9 | user | 2072 | 2.98 | 54.63 | 0.1 |
| 10 | ur | 287 | 0.02 | 7.57 | 0.1 |
| 11 | summarize | 272 | 0.02 | 7.17 | 0.1 |
| 12 | shit | 324 | 0.11 | 8.54 | 0.1 |
| 13 | bc | 328 | 0.17 | 8.65 | 0.1 |
| 14 | lol | 223 | 0.01 | 5.88 | 0.1 |
| 15 | yea | 213 | 0.01 | 5.62 | 0.1 |
| 16 | heredoc | 203 | 0.02 | 5.35 | 0.1 |
| 17 | idk | 189 | 0.03 | 4.98 | 0.1 |
| 18 | topic | 198 | 0.07 | 5.22 | 0.1 |
| 19 | retard | 170 | 0.01 | 4.48 | 0.1 |
| 20 | request | 856 | 2.01 | 22.57 | 0.1 |
| 21 | sure | 221 | 0.23 | 5.83 | 0.1 |
| 22 | oh | 138 | 0.01 | 3.64 | 0.1 |
| 23 | continue | 317 | 0.71 | 8.36 | 0.1 |
| 24 | lmfao | 119 | 0.00 | 3.14 | 0.1 |
| 25 | instruction | 321 | 0.77 | 8.46 | 0.1 |
| 26 | mate | 126 | 0.06 | 3.32 | 0.1 |
| 27 | lets | 269 | 0.63 | 7.09 | 0.1 |
| 28 | figure | 150 | 0.19 | 3.95 | 0.2 |
| 29 | damn | 105 | 0.01 | 2.77 | 0.2 |
| 30 | dude | 101 | 0.00 | 2.66 | 0.2 |

## Threshold receipts

- smoothing s = 0.5
- unigram min assistant count = 20
- n-gram min assistant count = 20
- empirical entries: ratio >= 8 and assistant count >= 30
- empirical stems: 0 | phrases: 0

## Caveats

- Stemming is crude: a single suffix (es/ed/ing/ly/s) is stripped left to right only when the remaining base is >= 4 chars; no dictionary, so `studies` becomes `studi` and `ruling` stays `ruling` because the base is 3 chars.
- Unigrams are counted on stems; 2/3-grams are counted on raw lowercase words, so a phrase may mix surface forms. Contractions and possessives (it's, that's) split into bare `s` tokens, which is why `s the` and `that s the` top the phrase list; that is a tokenization artifact, read those rows accordingly.
- Empirical bar (ratio >= 8 and assistant count >= 30, smoothing 0.5) returns no unigram stems in this corpus: the seeded offenders themselves score far below 8 (honest 3.4, ruling 3.3; distill has only 38 assistant hits), so the threshold selects no word as slop yet. The empirical list stays empty until the voice signal separates further as logs grow.
- Retention window truncates history: `~/.claude/projects` only holds sessions that have not expired, so older sessions where Chris and the assistant talked differently are missing.
- Harness-injected text (system-reminder, command-name, local-command, task-notification, tool cues) is excluded from the user corpus by dropping text blocks that start with `<` and contain one of those markers; the same rule is applied to plain-string user content. Tool results are never counted as user prose.
- Function words and any stem in the reverse (Chris-heavy) list are excluded from empirical lexicon entries to avoid function-word noise.
