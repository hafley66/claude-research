#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { compose } from "./1_theme.mjs";

const [input, manifest, output, ...extra] = process.argv.slice(2);
if (!input || !manifest || !output || extra.length || input === "--help") {
  console.log("Usage: node 2_compose.mjs input.d2 assignments.json output.d2\nManifest: {theme, palette, mode, seed, assignments: [{target, kind, group, role?, dash?}]}\nWrites self-contained D2 and output.d2.legend.json. Always compose from the original input.");
  process.exit(input === "--help" ? 0 : 1);
}
try {
  if (resolve(input) === resolve(output)) throw new Error("Keep original input and generated output paths separate");
  const { assignments = [], ...options } = JSON.parse(readFileSync(manifest, "utf8"));
  const rendered = compose(readFileSync(input, "utf8"), assignments, options);
  writeFileSync(output, rendered.source);
  writeFileSync(`${output}.legend.json`, `${JSON.stringify(rendered.legend, null, 2)}\n`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
