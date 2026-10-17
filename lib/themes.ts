export type Theme = {
  key: string;
  label: string;
  surface: string;
  brand: string;
  mode: "dark" | "light";
};

export const THEMES: Theme[] = [
  {
    key: "skub",
    label: "Skub",
    surface: "#1c1e22",
    brand: "#be185d",
    mode: "dark",
  },
  {
    key: "high-contrast",
    label: "High Contrast",
    surface: "#000000",
    brand: "#ffffff",
    mode: "dark",
  },
  {
    key: "digicam",
    label: "Digicam",
    surface: "#1b1518",
    brand: "#ef8aa4",
    mode: "dark",
  },
  {
    key: "matrix",
    label: "Matrix",
    surface: "#0a0c0a",
    brand: "#a8ff3a",
    mode: "dark",
  },
  {
    key: "moquette",
    label: "Moquette",
    surface: "#172f80",
    brand: "#dc241f",
    mode: "dark",
  },
  {
    key: "sash",
    label: "SASH!",
    surface: "#0b0b33",
    brand: "#ff2bd6",
    mode: "dark",
  },
  {
    key: "geocities",
    label: "GeoCities",
    surface: "#000000",
    brand: "#ffff00",
    mode: "dark",
  },
  {
    key: "dookie",
    label: "Dookie",
    surface: "#f6f0dc",
    brand: "#7cc6ea",
    mode: "light",
  },
  {
    key: "discman",
    label: "Discman",
    surface: "#e4e6e9",
    brand: "#e0601f",
    mode: "light",
  },
  {
    key: "riso",
    label: "Riso",
    surface: "#f4f1ea",
    brand: "#ff48b0",
    mode: "light",
  },
];

/** A stored key with no theme behind it (a retired theme) renders as skub. */
export function resolveTheme(stored: string | undefined): string {
  return THEMES.find((theme) => theme.key === stored)?.key ?? "skub";
}
