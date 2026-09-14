import { themes, palettes, roles, tint } from "./0_palettes.mjs";

export function themeKit({ theme = "midnight", palette = "categorical" } = {}) {
  const surface = themes[theme];
  const family = palettes[palette];
  if (!surface || !family) throw new Error(`Unknown theme/palette: ${theme}/${palette}`);
  const colors = family[surface.dark ? "dark" : "light"];
  // Semantic hues are fixed independently of the categorical palette choice.
  const semantic = palettes.categorical[surface.dark ? "dark" : "light"];
  const neutral = tint(surface.text, surface.background, 0.06);
  const overrides = {
    N1: surface.text, N2: surface.text, N3: surface.text,
    N4: colors[7 % colors.length], N5: neutral, N6: neutral, N7: surface.background,
    B1: colors[0], B2: colors[0], B3: colors[0], B4: neutral, B5: neutral, B6: neutral,
    AA2: semantic[1], AA4: neutral, AA5: neutral, AB4: neutral, AB5: neutral,
  };
  const classes = [];
  for (const [name, color, dash] of [
    ...colors.map((color, i) => [`c${i}`, color, 0]),
    ...Object.entries(roles).map(([name, role]) => [name, semantic[role.index], role.dash]),
  ]) {
    classes.push(`  kit_${name}: { style.fill: "${tint(color, surface.background)}"; style.stroke: "${color}"; style.font-color: "${surface.text}"; style.stroke-width: 2 }`);
    classes.push(`  kit_edge_${name}: { style.stroke: "${color}"; style.font-color: "${color}"; style.stroke-width: 3; style.stroke-dash: ${dash} }`);
  }
  const source = [
    `# D2 theme kit: ${theme} / ${palette}`,
    `vars: { d2-config: { theme-id: ${surface.themeID}; theme-overrides: { ${Object.entries(overrides).map(([key, value]) => `${key}: "${value}"`).join("; ")} } } }`,
    `style.fill: "${surface.background}"`,
    "classes: {", ...classes, "}",
  ].join("\n");
  return { source, colors, semantic, surface };
}

/**
 * assignments: {target: D2 key/edge selector, kind: "node"|"edge",
 *   group: stable label, role?: keyof roles, dash?: 0..10}[]
 * Group order is first occurrence. Shuffle permutes the palette once per seed,
 * then round-robins without replacement. Reuse group names for shared identity.
 */
export function assignStyles(assignments, { mode = "round-robin", seed = 1, ...options } = {}) {
  if (!["semantic", "round-robin", "shuffle"].includes(mode)) throw new Error(`Unknown mode: ${mode}`);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("seed must be a uint32");
  const kit = themeKit(options);
  const order = kit.colors.map((_, i) => i);
  let state = seed;
  if (mode === "shuffle") {
    for (let i = order.length - 1; i > 0; i--) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const j = Math.floor(state / 4294967296 * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
  }
  const groups = new Map();
  const lines = [];
  for (const item of assignments) {
    const { target, kind, group = target, role } = item;
    if (typeof target !== "string" || !target.trim() || /[\n\r{};]/.test(target)) throw new Error("target must be one D2 key or indexed connection selector");
    if (!["node", "edge"].includes(kind)) throw new Error(`Unknown assignment kind: ${kind}`);
    if (role != null && !Object.hasOwn(roles, role)) throw new Error(`Unknown role: ${role}`);
    if (mode === "semantic" && !role) throw new Error(`Semantic assignment needs role: ${target}`);
    if (item.dash != null && (!Number.isInteger(item.dash) || item.dash < 0 || item.dash > 10)) throw new Error("dash must be an integer 0..10");
    if (!groups.has(group)) {
      const index = groups.size;
      const cycle = Math.floor(index / order.length);
      const color = role ? kit.semantic[roles[role].index] : kit.colors[order[index % order.length]];
      groups.set(group, { group, role, color, dash: role ? roles[role].dash : [0, 3, 6][cycle % 3] });
    }
    const entry = groups.get(group);
    if (entry.role !== role) throw new Error(`Group ${group} has conflicting roles`);
    const dash = item.dash ?? entry.dash;
    // Explicit overrides also recolor edges with existing inline styles.
    lines.push(`${target}.style.stroke: "${entry.color}"`, `${target}.style.stroke-width: ${kind === "edge" ? 3 : 2}`);
    if (kind === "edge") {
      lines.push(`${target}.style.font-color: "${entry.color}"`, `${target}.style.stroke-dash: ${dash}`);
    } else {
      // Target ordinary shapes or wrappers, never sql_table/class bodies.
      lines.push(`${target}.style.fill: "${tint(entry.color, kit.surface.background)}"`, `${target}.style.font-color: "${kit.surface.text}"`);
    }
  }
  return { source: lines.join("\n"), legend: [...groups.values()], kit };
}

export function compose(source, assignments = [], options = {}) {
  const assigned = assignStyles(assignments, options);
  return {
    source: `${source.trimEnd()}\n\n${assigned.kit.source}\n\n# Explicit group assignments\n${assigned.source}\n`,
    legend: assigned.legend,
  };
}
