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
    key: "acid",
    label: "Acid",
    surface: "#0a0c0a",
    brand: "#a8ff3a",
    mode: "dark",
  },
  {
    key: "nocturne",
    label: "Nocturne",
    surface: "#282a36",
    brand: "#ff79c6",
    mode: "dark",
  },
  {
    key: "paper",
    label: "Paper",
    surface: "#fdf6e3",
    brand: "#7d6300",
    mode: "light",
  },
  {
    key: "kiln",
    label: "Kiln",
    surface: "#fbf3ec",
    brand: "#b4380a",
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
