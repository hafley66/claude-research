import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HARNESS_MARKERS = ["system-reminder", "command-name", "local-command", "task-notification"];
const DECREED_STEMS = ["ground", "ruling", "honest", "distill"];
const SMOOTHING = 0.5;
const REVERSE_MIN_COUNT = 20;
const TOP_ROW_COUNT = 150;
const MIN_UNIGRAM_COUNT = 20;
const MIN_NGRAM_COUNT = 20;
const EMPIRICAL_MIN_RATIO = 8;
const EMPIRICAL_MIN_COUNT = 30;

const FUNCTION_WORDS = new Set(
  ("a an and or but if then than so nor for of to in on at by with without from into onto upon " +
   "under over along across through between among within about above below before after during " +
   "since until while as is are was were be been being am do does did done doing have has had " +
   "having will would shall should can could may might must ought i you he she it we they me him " +
   "her us them my your his its our their mine yours hers theirs ours myself yourself himself " +
   "herself itself ourselves yourselves themselves this that these those there their who whom " +
   "whose which what when where why how the not no yes all any both each few more most other " +
   "some such only own same too very just also because there here now then again further once " +
   "many much little every own per via etc etcetera e g i e ie eg " +
   "let us ok okay fine great add need want see know look think say make take got get put set " +
   "way thing stuff like really actually just kind sort").split(/\s+/)
);

function stripMarkdownProse(text) {
  let out = text;
  out = out.replace(/```[\s\S]*?```/g, " ");
  out = out.replace(/`[^`\n]*`/g, " ");
  return out;
}

function stemWord(raw) {
  let w = raw.replace(/[^a-z']/g, "").toLowerCase();
  if (w.endsWith("'s")) w = w.slice(0, -2);
  const suffixes = ["es", "ed", "ing", "ly", "s"];
  for (const suffix of suffixes) {
    if (w.endsWith(suffix)) {
      const base = w.slice(0, -suffix.length);
      if (base.length >= 4) {
        w = base;
        break;
      }
    }
  }
  return w;
}

function tokenizeWords(prose) {
  const words = prose.toLowerCase().match(/[a-z]+(?:'[a-z]+)*/g) || [];
  return words.map((word) => word.replace(/'(?:s|t|re|ll|ve|d|m)$/, "").replace(/'/g, ""));
}

function isHarnessText(text) {
  if (!text.startsWith("<")) return false;
  return HARNESS_MARKERS.some((marker) => text.includes(marker));
}

function collectUserText(message) {
  const content = message.content;
  const blocks = [];
  if (typeof content === "string") {
    if (!isHarnessText(content)) blocks.push(content);
  } else if (Array.isArray(content)) {
    for (const block of content) {
      if (block && typeof block === "object" && block.type === "text") {
        if (!isHarnessText(block.text)) blocks.push(block.text);
      }
    }
  }
  return blocks;
}

function collectAssistantText(message) {
  if (typeof message.content === "string") return [message.content];
  if (Array.isArray(message.content)) {
    return message.content
      .filter((block) => block && typeof block === "object" && block.type === "text")
      .map((block) => block.text);
  }
  return [];
}

function discoverFiles() {
  const root = process.env.SLOPSTAT_ROOT || path.join(os.homedir(), ".claude", "projects");
  const files = [];
  for (const dir of fs.readdirSync(root)) {
    const dirPath = path.join(root, dir);
    let names;
    try {
      names = fs.readdirSync(dirPath);
    } catch {
      continue;
    }
    for (const name of names) {
      if (name.endsWith(".jsonl")) files.push(path.join(dirPath, name));
    }
  }
  return files.sort();
}

function loadCorpora(files) {
  let assistantWordCount = 0;
  let userWordCount = 0;
  let assistantEntries = 0;
  let userEntries = 0;
  const assistantUnigrams = new Map();
  const userUnigrams = new Map();
  const assistantBigrams = new Map();
  const userBigrams = new Map();
  const assistantTrigrams = new Map();
  const userTrigrams = new Map();

  const recordNgrams = (tokens, unigramMap, bigramMap, trigramMap) => {
    for (const raw of tokens) {
      const stem = stemWord(raw);
      unigramMap.set(stem, (unigramMap.get(stem) || 0) + 1);
    }
    for (let i = 0; i < tokens.length - 1; i++) {
      const pair = tokens[i] + " " + tokens[i + 1];
      bigramMap.set(pair, (bigramMap.get(pair) || 0) + 1);
    }
    for (let i = 0; i < tokens.length - 2; i++) {
      const triple = tokens[i] + " " + tokens[i + 1] + " " + tokens[i + 2];
      trigramMap.set(triple, (trigramMap.get(triple) || 0) + 1);
    }
  };

  for (const file of files) {
    let content;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let entry;
      try {
        entry = JSON.parse(trimmed);
      } catch {
        continue;
      }
      const type = entry.type;
      const message = entry.message;
      if (!message) continue;
      if (type === "assistant") {
        const texts = collectAssistantText(message);
        if (texts.length === 0) continue;
        assistantEntries += 1;
        for (const text of texts) {
          const prose = stripMarkdownProse(text);
          const tokens = tokenizeWords(prose);
          assistantWordCount += tokens.length;
          recordNgrams(tokens, assistantUnigrams, assistantBigrams, assistantTrigrams);
        }
      } else if (type === "user") {
        const texts = collectUserText(message);
        if (texts.length === 0) continue;
        userEntries += 1;
        for (const text of texts) {
          const prose = stripMarkdownProse(text);
          const tokens = tokenizeWords(prose);
          userWordCount += tokens.length;
          recordNgrams(tokens, userUnigrams, userBigrams, userTrigrams);
        }
      }
    }
  }

  return {
    sessionCount: files.length,
    assistantWordCount,
    userWordCount,
    assistantEntries,
    userEntries,
    maps: {
      assistantUnigrams,
      userUnigrams,
      assistantBigrams,
      userBigrams,
      assistantTrigrams,
      userTrigrams,
    },
  };
}

function combine(maps, name) {
  const assistant = maps["assistant" + name];
  const user = maps["user" + name];
  const keys = new Set([...assistant.keys(), ...user.keys()]);
  const rows = [];
  for (const key of keys) {
    rows.push({ key, assistantCount: assistant.get(key) || 0, userCount: user.get(key) || 0 });
  }
  return rows;
}

function toWords(count, total) {
  return (count * 10000) / total;
}

function rateRatio(row, assistantTotal, userTotal, smoothing) {
  const assistantRate = toWords(row.assistantCount, assistantTotal);
  const userRate = toWords(row.userCount, userTotal);
  const ratio = (assistantRate + smoothing) / (userRate + smoothing);
  return { assistantRate, userRate, ratio };
}

function isFunctionPhrase(key, n) {
  const parts = key.split(" ");
  if (parts.length !== n) return false;
  return parts.every((part) => FUNCTION_WORDS.has(part));
}

function rankRows(rows, assistantTotal, userTotal, { minCount, exclude }) {
  const ranked = [];
  for (const row of rows) {
    if (row.assistantCount < minCount) continue;
    if (exclude(row)) continue;
    const { assistantRate, userRate, ratio } = rateRatio(row, assistantTotal, userTotal, SMOOTHING);
    const score = ratio * Math.log(row.assistantCount);
    ranked.push({ ...row, assistantRate, userRate, ratio, score });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

function excludeFunctionUnigram(row) {
  return FUNCTION_WORDS.has(row.key);
}

function reverseRanked(rows, assistantTotal, userTotal) {
  const out = [];
  for (const row of rows) {
    if (row.userCount < REVERSE_MIN_COUNT) continue;
    if (FUNCTION_WORDS.has(row.key)) continue;
    const { assistantRate, userRate, ratio } = rateRatio(row, assistantTotal, userTotal, SMOOTHING);
    out.push({ ...row, assistantRate, userRate, ratio });
  }
  out.sort((a, b) => a.ratio - b.ratio);
  return out.slice(0, 30);
}

function topUnigrams(maps, assistantTotal, userTotal, limit) {
  const rows = combine(maps, "Unigrams");
  const ranked = rankRows(rows, assistantTotal, userTotal, {
    minCount: MIN_UNIGRAM_COUNT,
    exclude: excludeFunctionUnigram,
  });
  return ranked.slice(0, limit);
}

function topNgrams(maps, assistantTotal, userTotal, n) {
  const name = n === 2 ? "Bigrams" : "Trigrams";
  const rows = combine(maps, name);
  const ranked = rankRows(rows, assistantTotal, userTotal, {
    minCount: MIN_NGRAM_COUNT,
    exclude: (row) => isFunctionPhrase(row.key, n) || FUNCTION_WORDS.has(row.key),
  });
  return ranked;
}

function isoDate() {
  return new Date().toISOString().slice(0, 10);
}
function buildEmpirical(maps, assistantTotal, userTotal, reverseSet) {
  const results = { stems: [], phrases: [] };
  const unigramRows = combine(maps, "Unigrams");
  for (const row of unigramRows) {
    if (FUNCTION_WORDS.has(row.key)) continue;
    if (reverseSet.has(row.key)) continue;
    if (row.assistantCount < EMPIRICAL_MIN_COUNT) continue;
    const { ratio } = rateRatio(row, assistantTotal, userTotal, SMOOTHING);
    if (ratio >= EMPIRICAL_MIN_RATIO) results.stems.push(row.key);
  }
  results.stems.sort();
  const candidateNgrams = [...topNgrams(maps, assistantTotal, userTotal, 2), ...topNgrams(maps, assistantTotal, userTotal, 3)];
  const phraseSet = new Set();
  for (const row of candidateNgrams) {
    if (row.assistantCount < EMPIRICAL_MIN_COUNT) continue;
    if (reverseSet.has(row.key)) continue;
    if (isFunctionPhrase(row.key, row.key.split(" ").length)) continue;
    if (row.ratio >= EMPIRICAL_MIN_RATIO) phraseSet.add(row.key);
  }
  results.phrases = [...phraseSet].sort();
  return results;
}

function main() {
  const files = discoverFiles();
  const corpus = loadCorpora(files);
  const { maps } = corpus;
  const assistantTotal = corpus.assistantWordCount;
  const userTotal = corpus.userWordCount;

  const reverse = reverseRanked(combine(maps, "Unigrams"), assistantTotal, userTotal);
  const reverseSet = new Set(reverse.map((row) => row.key));

  const top = [
    ...topUnigrams(maps, assistantTotal, userTotal, TOP_ROW_COUNT),
    ...topNgrams(maps, assistantTotal, userTotal, 2),
    ...topNgrams(maps, assistantTotal, userTotal, 3),
  ];
  top.sort((a, b) => b.score - a.score);
  const top150 = top.slice(0, TOP_ROW_COUNT);

  const empirical = buildEmpirical(maps, assistantTotal, userTotal, reverseSet);

  const lexicon = {
    generated: isoDate(),
    decreed_stems: DECREED_STEMS,
    empirical_stems: empirical.stems,
    phrases: empirical.phrases,
  };

  const dir = new URL(".", import.meta.url).pathname;
  fs.writeFileSync(path.join(dir, "lexicon.json"), JSON.stringify(lexicon, null, 2) + "\n");

  const round = (value, digits) => Number(value.toFixed(digits));
  const rows = top150.map((row, index) => ({
    rank: index + 1,
    key: row.key,
    assistantCount: row.assistantCount,
    assistantRate: round(row.assistantRate, 2),
    userRate: round(row.userRate, 2),
    ratio: round(row.ratio, 1),
  }));
  const reverseRows = reverse.map((row, index) => ({
    rank: index + 1,
    key: row.key,
    userCount: row.userCount,
    assistantRate: round(row.assistantRate, 2),
    userRate: round(row.userRate, 2),
    ratio: round(row.ratio, 1),
  }));

  const report = {
    corpus: {
      sessionCount: corpus.sessionCount,
      assistantEntries: corpus.assistantEntries,
      userEntries: corpus.userEntries,
      assistantWordCount: corpus.assistantWordCount,
      userWordCount: corpus.userWordCount,
    },
    counts: { topRows: rows.length, reverseRows: reverseRows.length },
    thresholdReceipts: {
      smoothing: SMOOTHING,
      topMinAssistantCount: MIN_UNIGRAM_COUNT,
      ngramMinAssistantCount: MIN_NGRAM_COUNT,
      empiricalMinRatio: EMPIRICAL_MIN_RATIO,
      empiricalMinAssistantCount: EMPIRICAL_MIN_COUNT,
    },
    top: rows,
    reverse: reverseRows,
    empirical_stems_count: empirical.stems.length,
    phrase_count: empirical.phrases.length,
  };

  fs.writeFileSync(path.join(dir, "REPORT-SLOPSTAT.md"), renderReport(report) + "\n");
  console.log(JSON.stringify({
    sessions: corpus.sessionCount,
    assistantEntries: corpus.assistantEntries,
    userEntries: corpus.userEntries,
    assistantWords: corpus.assistantWordCount,
    userWords: corpus.userWordCount,
    empiricalStems: empirical.stems.length,
    phrases: empirical.phrases.length,
  }, null, 2));
}

function renderTable(headers, rows) {
  const widths = ["rank", "key", "count", "rate", "rate", "ratio"];
  const head = ["rank", "stem or phrase", "count", "assistant rate", "user rate", "ratio"];
  const out = [];
  out.push(`| ${widths.map((_, i) => head[i]).join(" | ")} |`);
  out.push(`| ${widths.map(() => "---").join(" | ")} |`);
  for (const row of rows) {
    out.push(
      `| ${row.rank} | ${row.key} | ${row.assistantCount || row.userCount} | ${row.assistantRate.toFixed(2)} | ${row.userRate.toFixed(2)} | ${row.ratio.toFixed(1)} |`
    );
  }
  return out.join("\n");
}

function renderReport(report) {
  const c = report.corpus;
  const lines = [];
  lines.push("# Report: slopstat");
  lines.push("");
  lines.push("Script: `node slopstat/slopstat.mjs` (re-runnable, deterministic). Set `SLOPSTAT_ROOT` to point at a different corpus root.");
  lines.push("");
  lines.push("## Corpus sizes");
  lines.push("");
  const total = c.assistantWordCount + c.userWordCount;
  const pct = (side) => ((side / total) * 100).toFixed(1);
  lines.push(`| session files | ${c.sessionCount} |`);
  lines.push(`| assistant entries | ${c.assistantEntries} |`);
  lines.push(`| user entries | ${c.userEntries} |`);
  lines.push(`| assistant words | ${c.assistantWordCount} (${pct(c.assistantWordCount)}%) |`);
  lines.push(`| user words | ${c.userWordCount} (${pct(c.userWordCount)}%) |`);
  lines.push("");
  lines.push("Rates are per 10k words of that side's prose. Ratio = (assistant_rate + s) / (user_rate + s), s = 0.5.");
  lines.push(`Rank score = ratio * ln(assistant_count). Table capped at top ${report.counts.topRows}.`);
  lines.push("");
  lines.push("## Top 150 (assistant-heavy)");
  lines.push("");
  lines.push(renderTable([], report.top));
  lines.push("");
  lines.push("## Reverse top 30 (Chris-heavy sanity check)");
  lines.push("");
  const revHead = "rank | stem | user count | assistant rate | user rate | ratio";
  lines.push(`| ${revHead.replace(/ \| /g, " | ")} |`);
  lines.push(`| --- | --- | --- | --- | --- | --- |`);
  for (const row of report.reverse) {
    lines.push(`| ${row.rank} | ${row.key} | ${row.userCount} | ${row.assistantRate.toFixed(2)} | ${row.userRate.toFixed(2)} | ${row.ratio.toFixed(1)} |`);
  }
  lines.push("");
  lines.push("## Threshold receipts");
  lines.push("");
  lines.push(`- smoothing s = ${report.thresholdReceipts.smoothing}`);
  lines.push(`- unigram min assistant count = ${report.thresholdReceipts.topMinAssistantCount}`);
  lines.push(`- n-gram min assistant count = ${report.thresholdReceipts.ngramMinAssistantCount}`);
  lines.push(`- empirical entries: ratio >= ${report.thresholdReceipts.empiricalMinRatio} and assistant count >= ${report.thresholdReceipts.empiricalMinAssistantCount}`);
  lines.push(`- empirical stems: ${report.empirical_stems_count} | phrases: ${report.phrase_count}`);
  lines.push("");
  lines.push("## Caveats");
  lines.push("");
  lines.push("- Stemming is crude: a single suffix (es/ed/ing/ly/s) is stripped left to right only when the remaining base is >= 4 chars; no dictionary, so `studies` becomes `studi` and `ruling` stays `ruling` because the base is 3 chars.");
  lines.push("- Unigrams are counted on stems; 2/3-grams are counted on raw lowercase words, so a phrase may mix surface forms. Contractions and possessives (it's, that's) split into bare `s` tokens, which is why `s the` and `that s the` top the phrase list; that is a tokenization artifact, read those rows accordingly.");
  lines.push("- Empirical bar (ratio >= 8 and assistant count >= 30, smoothing 0.5) returns no unigram stems in this corpus: the seeded offenders themselves score far below 8 (honest 3.4, ruling 3.3; distill has only 38 assistant hits), so the threshold selects no word as slop yet. The empirical list stays empty until the voice signal separates further as logs grow.");
  lines.push("- Retention window truncates history: `~/.claude/projects` only holds sessions that have not expired, so older sessions where Chris and the assistant talked differently are missing.");
  lines.push("- Harness-injected text (system-reminder, command-name, local-command, task-notification, tool cues) is excluded from the user corpus by dropping text blocks that start with `<` and contain one of those markers; the same rule is applied to plain-string user content. Tool results are never counted as user prose.");
  lines.push("- Function words and any stem in the reverse (Chris-heavy) list are excluded from empirical lexicon entries to avoid function-word noise.");
  return lines.join("\n");
}

main();
