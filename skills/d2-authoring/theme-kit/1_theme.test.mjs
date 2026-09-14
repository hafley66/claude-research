import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { themes, palettes } from "./0_palettes.mjs";
import { assignStyles, compose } from "./1_theme.mjs";

test("group identity, palette exhaustion, semantic roles, and deterministic shuffle", () => {
  const items = Array.from({ length: 34 }, (_, i) => ({ target: `(a -> b)[${i}]`, kind: "edge", group: `g${i}` }));
  const first = assignStyles(items);
  assert.deepEqual(first.legend.filter((_, i) => [0, 15, 16, 32].includes(i)), [
    { group: "g0", role: undefined, color: "#67d5e8", dash: 0 },
    { group: "g15", role: undefined, color: "#c5c9cb", dash: 0 },
    { group: "g16", role: undefined, color: "#67d5e8", dash: 3 },
    { group: "g32", role: undefined, color: "#67d5e8", dash: 6 },
  ]);
  assert.equal(assignStyles([...items, { ...items[0], target: "(b -> c)[0]" }]).legend.length, 34);
  const shuffled = assignStyles(items, { mode: "shuffle", seed: 42 });
  assert.deepEqual(shuffled, assignStyles(items, { mode: "shuffle", seed: 42 }));
  assert.notDeepEqual(shuffled.legend, assignStyles(items, { mode: "shuffle", seed: 43 }).legend);
  assert.equal(new Set(shuffled.legend.slice(0, 16).map((g) => g.color)).size, 16);
  assert.equal(assignStyles([{ ...items[0], role: "failure" }], { mode: "semantic", palette: "clear" }).legend[0].color, "#ff9784");
  assert.throws(() => assignStyles(items, { mode: "semantic" }), /needs role/);
  assert.throws(() => assignStyles([{ ...items[0], role: "typo" }]), /Unknown role/);
  assert.throws(() => assignStyles([{ ...items[0], dash: 11 }]), /dash must/);
  assert.throws(() => assignStyles([{ ...items[0], role: "data" }, { ...items[0], role: "failure" }]), /conflicting roles/);
});

function luminance(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}

test("every palette edge label has at least 4.5:1 contrast against its canvas", () => {
  for (const surface of Object.values(themes)) {
    for (const palette of Object.values(palettes)) {
      for (const color of palette[surface.dark ? "dark" : "light"]) {
        const a = luminance(color), b = luminance(surface.background);
        assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5, `${color} on ${surface.background}`);
      }
    }
  }
});

test("all themes and palettes compile for graph, SQL wrapper, and sequence edges", () => {
  const dir = mkdtempSync(join(tmpdir(), "d2-theme-test-"));
  try {
    for (const theme of Object.keys(themes)) for (const palette of Object.keys(palettes)) {
      for (const sequence of [false, true]) {
        const input = sequence ? "shape: sequence_diagram\na\nb\na -> b: send\na -> b: retry" : 'a: { table: { shape: sql_table; id: int } }\nb\na -> b: send\na -> b: retry { style.stroke: "#000000" }';
        const { source } = compose(input, [
          { target: "a", kind: "node", group: "sender", role: "data" },
          { target: "(a -> b)[0]", kind: "edge", group: "sender", role: "data" },
          { target: "(a -> b)[1]", kind: "edge", group: "retry", role: "warning" },
        ], { theme, palette });
        const path = join(dir, "input.d2");
        writeFileSync(path, source);
        const result = spawnSync("d2", [path, "-"], { encoding: "utf8", timeout: 30000, maxBuffer: 5e6 });
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /<svg/);
        const warning = palettes.categorical[themes[theme].dark ? "dark" : "light"][5];
        assert.ok(result.stdout.includes(`stroke="${warning}"`));
      }
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
