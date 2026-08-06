#!/usr/bin/env node
// Grades only mdast text nodes (code/html exempt by node type); laws = ~/.claude/CLAUDE.md.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import sbd from "sbd";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const BUILTIN_DECREED_STEMS = ["ground", "ruling", "honest", "distill"];

function lexiconPathCandidates() {
  return [
    process.env.PROSE_PROD_LEXICON,
    join(scriptDir, "../slopstat/lexicon.json"),
    join(scriptDir, "lexicon.json"),
  ].filter(Boolean);
}

export function loadLexicon() {
  for (const path of lexiconPathCandidates()) {
    try {
      if (existsSync(path)) {
        const parsed = JSON.parse(readFileSync(path, "utf8"));
        return {
          decreed_stems: parsed.decreed_stems || [],
          empirical_stems: parsed.empirical_stems || [],
          phrases: parsed.phrases || [],
          stem_allow: parsed.stem_allow || {},
        };
      }
    } catch {
      // Try the next lexicon candidate.
    }
  }
  return { decreed_stems: [...BUILTIN_DECREED_STEMS], empirical_stems: [], phrases: [], stem_allow: {} };
}

const LEXICON = loadLexicon();

const RULES = [
  {
    id: "banned-word",
    test: (sentence) => /\b(provenance|substrate|load[- ]bearing|regime)s?\b/i.test(sentence),
    law: "Banned words: provenance, substrate, load-bearing, regime. Use source/base/critical/mode.",
  },
  {
    id: "sycophancy",
    test: (sentence) => /\b(you'?re absolutely right|absolutely right|great question)\b/i.test(sentence) || /^exactly[.!]$/i.test(sentence.trim()),
    law: "No sycophancy phrases.",
  },
  {
    id: "text-speak",
    test: (sentence) => /(^|[^\w'])(u|ur)([^\w']|$)/.test(sentence),
    law: "No text-speak pronouns: always you/your.",
  },
  {
    id: "neg-parallelism",
    test: (sentence) =>
      /\bnot\s+[^,.;:]{1,50},\s*(?:but\s+|just\s+|rather\s+)?[a-z]/i.test(sentence) ||
      /\b\w+n'?t\s+[^,.;:]{1,50},\s*(?:it'?s|that'?s|this is|but\b|just\b|rather\b)/i.test(sentence) ||
      /^Not\s+\S+.*[.!]$/.test(sentence.trim()),
    law: "No negative parallelism (not X, Y / X. Not Y.). State the positive claim.",
  },
  {
    id: "deictic-filler",
    test: (sentence) => /^(Here'?s\b|Here (is|are)\b|Below (is|are)\b|The following\b)|\bas follows[:.]/i.test(sentence.trim()),
    law: "No location announcements; the next words are the location. Point with file:line or names.",
  },
  {
    id: "hedge-slop",
    test: (sentence) => /\b(it'?s worth noting|importantly|notably|in essence|essentially|robust|comprehensive|seamless|leverag(?:e|es|ed|ing)|utiliz(?:e|es|ed|ing)|delve[sd]?)\b/i.test(sentence),
    law: "No hedge or slop phrasing.",
  },
  {
    id: "vague-quantity",
    test: (sentence) => /\b(several|various|numerous|a number of)\s+\w+s\b/i.test(sentence),
    law: "No vague quantities; give the number.",
  },
];

const STEM_SUFFIX = /^(?:s|es|ed|ing|ly|ings)?$/;

function stemHitsWord(word, stem, allowWords) {
  const lower = word.toLowerCase();
  if (allowWords.some((allowed) => allowed.toLowerCase() === lower)) return false;
  return lower.split("-").some((part) => part.startsWith(stem) && STEM_SUFFIX.test(part.slice(stem.length)));
}

function buildStemRule(id, stems, allow, law) {
  const allowMap = allow || {};
  const normalized = stems.filter(Boolean).map((stem) => stem.toLowerCase());
  return {
    id,
    law,
    test: (sentence) => {
      const tokens = sentence.match(/[A-Za-z]+(?:-[A-Za-z]+)*/g) || [];
      return normalized.filter((stem) =>
        tokens.some((token) => stemHitsWord(token, stem, allowMap[stem] || [])),
      );
    },
  };
}

if (LEXICON.decreed_stems.length) {
  RULES.push(buildStemRule("decreed-stem", LEXICON.decreed_stems, LEXICON.stem_allow, "Decreed slop words banned."));
}
if (LEXICON.empirical_stems.length) {
  RULES.push(buildStemRule("empirical-stem", LEXICON.empirical_stems, LEXICON.stem_allow, "Empirically derived slop words banned."));
}

// Stem rules report the matched stem per finding; boolean rules report once.
function ruleFindings(rule, sentence) {
  const result = rule.test(sentence);
  if (Array.isArray(result)) {
    return result.map((stem) => ({ id: rule.id, law: `${rule.law} (stem: ${stem})`, sentence }));
  }
  return result ? [{ id: rule.id, law: rule.law, sentence }] : [];
}

// Pair rule: "isn't X. It's Y." spans two sentences, so it runs over the
// sentence list, off the per-sentence loop.
function pairFindings(sentences) {
  const findings = [];
  for (let index = 0; index + 1 < sentences.length; index++) {
    if (/(n'?t\b|\bnot\b)/i.test(sentences[index]) && /^(It|That|This)('s| is| was)\b/.test(sentences[index + 1].trim())) {
      findings.push({
        id: "neg-parallelism",
        law: "No negative parallelism split across periods (isn't X. It's Y.).",
        sentence: `${sentences[index]} ${sentences[index + 1]}`,
      });
    }
  }
  return findings;
}

// Ordinals are structure markers, never flourishes, so they stay legal in the
// closing position the one-word rule guards.
const ORDINAL_WORDS = new Set([
  "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth",
  "ninth", "tenth", "next", "last", "finally",
]);

function isOrdinalSentence(sentence) {
  const word = sentence.trim().replace(/[.!]$/, "").toLowerCase();
  return ORDINAL_WORDS.has(word) || /^\d+(st|nd|rd|th)?$/.test(word);
}

// The one-word law bites on the TURN'S closing sentence, where a bare word
// reads as a drum hit. Mid-turn a one-word sentence is ordinary terseness.
function finalCloseFindings(lastSentence) {
  const findings = [];
  if (/\b(The bottom line|At the end of the day|Simply put)\b/i.test(lastSentence)) {
    findings.push({ id: "rhetorical-close", law: "No rhetorical closers; state the result and stop.", sentence: lastSentence });
  }
  if (/^[A-Za-z'-]+[.!]$/.test(lastSentence.trim()) && !isOrdinalSentence(lastSentence)) {
    findings.push({
      id: "one-word-sentence",
      law: "No one-word sentence closing the turn; ordinals are exempt.",
      sentence: lastSentence,
    });
  }
  return findings;
}

// Seam: markdown to text node values; a future extract --lang md replaces this body.
function textNodes(markdown) {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  const nodes = [];
  visit(tree, "text", (node) => nodes.push(node.value));
  return nodes;
}

export function grade(markdown) {
  const findings = [];
  const nodeTexts = textNodes(markdown);
  let lastSentence = "";
  for (const nodeText of nodeTexts) {
    const sentences = sbd.sentences(nodeText, { newline_boundaries: true });
    for (const sentence of sentences) {
      for (const rule of RULES) {
        findings.push(...ruleFindings(rule, sentence));
      }
    }
    if (sentences.length) lastSentence = sentences[sentences.length - 1];
    findings.push(...pairFindings(sentences));
  }
  findings.push(...finalCloseFindings(lastSentence));
  return findings;
}

function turnText(transcriptPath) {
  const lines = readFileSync(transcriptPath, "utf8").split("\n").filter(Boolean);
  const entries = lines.map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
  let lastUser = -1;
  entries.forEach((entry, index) => {
    if (entry.type !== "user") return;
    const content = entry.message?.content;
    const hasText = typeof content === "string" ||
      (Array.isArray(content) && content.some((block) => block.type === "text"));
    if (hasText) lastUser = index;
  });
  const blocks = [];
  for (const entry of entries.slice(lastUser + 1)) {
    if (entry.type !== "assistant") continue;
    for (const block of entry.message?.content ?? []) {
      if (block.type === "text" && block.text) blocks.push(block.text);
    }
  }
  return blocks.join("\n\n");
}

function report(findings) {
  if (findings.length === 0) process.exit(0);
  const lines = ["PROSE LAW VIOLATION (assistant turn):"];
  for (const finding of findings) {
    const excerpt = finding.sentence.length > 120 ? `${finding.sentence.slice(0, 117)}...` : finding.sentence;
    lines.push(`  [${finding.id}] ${excerpt}`);
    lines.push(`      law: ${finding.law}`);
  }
  lines.push(
    "Fix: emit ONLY the corrected sentences, one per line, each prefixed 'corrected: '." +
      " The rest of the message is already in the transcript; repeating it burns tokens for nothing.",
  );
  process.stderr.write(lines.join("\n") + "\n");
  process.exit(2);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const mode = process.argv[2];
  if (mode === "--text") {
    const source = process.argv[3] === "-" ? readFileSync(0, "utf8") : readFileSync(process.argv[3], "utf8");
    report(grade(source));
  } else if (mode === "--transcript") {
    report(grade(turnText(process.argv[3])));
  } else if (mode === "--hook") {
    let input = {};
    try { input = JSON.parse(readFileSync(0, "utf8")); } catch { process.exit(0); }
    if (input.stop_hook_active) process.exit(0);
    if (!input.transcript_path) process.exit(0);
    let text = "";
    try { text = turnText(input.transcript_path); } catch { process.exit(0); }
    if (!text) process.exit(0);
    report(grade(text));
  } else {
    process.stderr.write("usage: prose-prod --hook | --text <file|-> | --transcript <path>\n");
    process.exit(1);
  }
}
