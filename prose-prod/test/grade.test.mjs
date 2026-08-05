import { test } from "node:test";
import assert from "node:assert/strict";
import { grade } from "../prose-prod.mjs";

function count(findings, id) {
  return findings.filter((finding) => finding.id === id).length;
}
function has(findings, id) {
  return findings.some((finding) => finding.id === id);
}
function ids(findings) {
  return [...new Set(findings.map((finding) => finding.id))];
}

test("every per-sentence rule fires at least once", () => {
  const doc = [
    "An em dash — appears here.",
    "The provenance of the substrate is load-bearing in the regime.",
    "You're absolutely right, great question.",
    "u should check ur notes.",
    "No.",
    "This isn't robust, it's fragile. That's the point.",
    "It's worth noting, importantly, notably, in essence, essentially, robust, comprehensive, seamless, leverage, utilize, delve.",
    "There were several findings, various signals, numerous cases, and a number of bugs.",
  ].join("\n\n");
  const findings = grade(doc);
  for (const id of ["em-dash", "banned-word", "sycophancy", "text-speak", "one-word-sentence", "neg-parallelism", "hedge-slop", "vague-quantity"]) {
    assert.ok(count(findings, id) > 0, `rule ${id} should fire`);
  }
});

test("rhetorical-close fires only on the final sentence", () => {
  const doc = "The work is done and shipped. At the end of the day, it works.";
  const findings = grade(doc);
  assert.ok(count(findings, "rhetorical-close") === 1);
  const close = findings.filter((f) => f.id === "rhetorical-close")[0];
  assert.match(close.sentence, /At the end of the day/);
});

test("a closer in the middle is not a rhetorical close", () => {
  const findings = grade("Simply put, we built the thing. Then we stopped.");
  assert.ok(count(findings, "rhetorical-close") === 0);
});

test("decreed stems fire with the exact count", () => {
  const findings = grade("The re-grounded ruling was honestly distilled.");
  assert.ok(count(findings, "decreed-stem") === 4);
});

test("ground allowlist words do not fire the ground stem", () => {
  const findings = grade("Background music played near the underground playground.");
  for (const finding of findings) {
    assert.notEqual(finding.id, "decreed-stem");
  }
});

test("code fences and inline code are exempt", () => {
  const doc = [
    "```js",
    "const provenance = \"substrate\";",
    "const note = \"This isn't robust, it's fragile.\";",
    "```",
    "Use the `background ground` and `re-grounded` inline code here.",
  ].join("\n");
  const findings = grade(doc);
  assert.deepEqual(ids(findings), []);
});

test("gfm table cell fires the banned-word rule", () => {
  const doc = [
    "| term | meaning |",
    "| --- | --- |",
    "| provenance | origin of the data |",
    "| mode | operating state |",
  ].join("\n");
  const findings = grade(doc);
  assert.ok(count(findings, "banned-word") >= 1);
  assert.ok(findings.some((f) => /provenance/i.test(f.sentence)));
});

test("clean document with abbreviations has zero findings", () => {
  const doc = [
    "Dr. Smith summarized the result, e.g. the fig. 2 chart and the fig. 3 table.",
    "The v6/prolog paths and the 3-node graph are in `ground/` and `grounding.ts`.",
    "Total bytes read: 4096.",
  ].join("\n\n");
  const findings = grade(doc);
  assert.deepEqual(findings, []);
});
