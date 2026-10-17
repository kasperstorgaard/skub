export type Theme = {
  key: string;
  label: string;
  surface: string;
  brand: string;
  section: "dark" | "light" | "retro" | "accessibility";
};

export const THEMES: Theme[] = [
  {
    key: "skub",
    label: "Skub",
    surface: "#1c1e22",
    brand: "#be185d",
    section: "dark",
  },
  {
    key: "dracula",
    label: "Dracula",
    surface: "#282a36",
    brand: "#ff79c6",
    section: "dark",
  },
  {
    key: "acid",
    label: "Acid",
    surface: "#0d0d0d",
    brand: "#00ff41",
    section: "dark",
  },
  {
    key: "catppuccin",
    label: "Catppuccin",
    surface: "#eff1f5",
    brand: "#8839ef",
    section: "light",
  },
  {
    key: "solarized-light",
    label: "Solarized Light",
    surface: "#fdf6e3",
    brand: "#b58900",
    section: "light",
  },
  {
    key: "ember",
    label: "Ember",
    surface: "#ffffff",
    brand: "#b91c1c",
    section: "light",
  },
  {
    key: "digicam",
    label: "Digicam",
    surface: "#1b1518",
    brand: "#ef8aa4",
    section: "retro",
  },
  {
    key: "matrix",
    label: "Matrix",
    surface: "#0a0c0a",
    brand: "#a8ff3a",
    section: "retro",
  },
  {
    key: "moquette",
    label: "Moquette",
    surface: "#172f80",
    brand: "#dc241f",
    section: "retro",
  },
  {
    key: "sash",
    label: "SASH!",
    surface: "#0b0b33",
    brand: "#ff2bd6",
    section: "retro",
  },
  {
    key: "geocities",
    label: "GeoCities",
    surface: "#000000",
    brand: "#ffff00",
    section: "retro",
  },
  {
    key: "dookie",
    label: "Dookie",
    surface: "#f6f0dc",
    brand: "#7cc6ea",
    section: "retro",
  },
  {
    key: "discman",
    label: "Discman",
    surface: "#e4e6e9",
    brand: "#e0601f",
    section: "retro",
  },
  {
    key: "riso",
    label: "Riso",
    surface: "#f4f1ea",
    brand: "#ff48b0",
    section: "retro",
  },
  {
    key: "high-contrast",
    label: "High Contrast",
    surface: "#000000",
    brand: "#ffffff",
    section: "accessibility",
  },
];

/** A stored key with no theme behind it (a retired theme) renders as skub. */
export function resolveTheme(stored: string | undefined): string {
  return THEMES.find((theme) => theme.key === stored)?.key ?? "skub";
}
