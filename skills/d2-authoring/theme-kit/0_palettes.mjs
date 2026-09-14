// Each theme pairs readable text with a canvas and tinted category surfaces.
export const themes = {
  midnight: { background: "#101820", text: "#edf3f8", dark: true, themeID: 200 },
  charcoal: { background: "#242424", text: "#f5f2e9", dark: true, themeID: 200 },
  paper: { background: "#faf8f2", text: "#18232d", dark: false, themeID: 8 },
};

// Light/dark are paired by category, so theme switching preserves color meaning.
// No magenta. Expanded colors require labels; they are not all perceptually distinct.
export const palettes = {
  categorical: {
    dark: ["#67d5e8", "#ffc66d", "#91c4ff", "#a5dc83", "#ff9784", "#e5d482", "#75d9b0", "#c0cce0", "#f2ad78", "#86cad4", "#bcd16d", "#b7b5fb", "#e2bda5", "#7eb5ef", "#d4dfa4", "#c5c9cb"],
    light: ["#006b7c", "#8b5100", "#215ea8", "#376b21", "#a03424", "#706000", "#006c4c", "#495e7b", "#995017", "#266571", "#526b00", "#5651a0", "#805440", "#2c6294", "#56632c", "#535b60"],
  },
  clear: {
    dark: ["#73c8ff", "#ffbf69", "#74d9bb", "#ff9784", "#e4d888", "#c2cbd5", "#b6da89", "#b8b7f1"],
    light: ["#0065a2", "#925300", "#006b53", "#a33c2c", "#706000", "#4f5b69", "#426827", "#5955a0"],
  },
};

export const roles = {
  data: { index: 0, dash: 0, label: "Data / observation" },
  control: { index: 1, dash: 0, label: "Control / command" },
  identity: { index: 2, dash: 0, label: "Identity / reference" },
  success: { index: 3, dash: 0, label: "Success / live" },
  failure: { index: 4, dash: 0, label: "Failure / closed" },
  warning: { index: 5, dash: 3, label: "Warning / unresolved" },
  storage: { index: 6, dash: 0, label: "Storage / durable" },
  inactive: { index: 7, dash: 5, label: "Inactive / deferred" },
};

export function tint(hex, background, amount = 0.13) {
  const channels = [1, 3, 5].map((i) => Math.round(
    parseInt(hex.slice(i, i + 2), 16) * amount + parseInt(background.slice(i, i + 2), 16) * (1 - amount),
  ).toString(16).padStart(2, "0"));
  return `#${channels.join("")}`;
}
