#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { themes, palettes, roles } from "./0_palettes.mjs";
import { themeKit, compose } from "./1_theme.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, "4_gallery");
mkdirSync(out, { recursive: true });
mkdirSync(join(root, "2_presets"), { recursive: true });
for (const theme of Object.keys(themes)) for (const palette of Object.keys(palettes)) {
  writeFileSync(join(root, "2_presets", `${theme}_${palette}.d2`), `${themeKit({ theme, palette }).source}\n`);
}
const pages = ["# D2 theme kit gallery", "Editable, self-contained fences for Instant. Color identifies a named role or group. Labels remain authoritative; shuffled colors carry no status meaning."];
const samples = [
  { theme: "midnight", palette: "categorical", mode: "semantic" },
  { theme: "charcoal", palette: "categorical", mode: "round-robin" },
  { theme: "paper", palette: "categorical", mode: "round-robin" },
  { theme: "midnight", palette: "clear", mode: "shuffle", seed: 42 },
];
for (const [sample, options] of samples.entries()) {
  const semantic = options.mode === "semantic";
  const count = semantic ? 16 : 20;
  const lines = ["vars: { d2-config: { layout-engine: dagre; pad: 32 } }", "direction: down"];
  const assignments = [];
  for (let i = 0; i < count; i++) {
    const role = semantic ? Object.keys(roles)[i % 8] : undefined;
    const group = role ?? `Group ${String(i + 1).padStart(2, "0")}`;
    lines.push(`n${i}: "${semantic ? roles[role].label : group}"`);
    assignments.push({ target: `n${i}`, kind: "node", group, role });
    if (i >= 4) {
      lines.push(`n${i - 4} -> n${i}: "${group}"`);
      assignments.push({ target: `(n${i - 4} -> n${i})[0]`, kind: "edge", group, role });
    }
  }
  const built = compose(lines.join("\n"), assignments, options);
  const name = `${sample}_${options.theme}_${options.mode}`;
  writeFileSync(join(out, `${name}.d2`), built.source);
  writeFileSync(join(out, `${name}.json`), `${JSON.stringify({ ...options, assignments }, null, 2)}\n`);
  const result = spawnSync("d2", [join(out, `${name}.d2`), join(out, `${name}.svg`)], { encoding: "utf8", timeout: 30000 });
  if (result.status !== 0) throw new Error(result.stderr);
  const raster = spawnSync("rsvg-convert", ["-w", "1400", "-o", join(out, `${name}.png`), join(out, `${name}.svg`)], { encoding: "utf8" });
  if (raster.status !== 0) throw new Error(raster.stderr);
  pages.push(`## ${options.theme} / ${options.palette} / ${options.mode}`, `\`\`\`d2\n${built.source}\`\`\``);
}
writeFileSync(join(out, "index.md"), `${pages.join("\n\n")}\n`);
console.log(`Wrote ${samples.length} compiled gallery diagrams and 6 importable presets.`);
