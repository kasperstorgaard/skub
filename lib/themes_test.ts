import { assert, assertEquals } from "@std/assert";

import { resolveTheme, THEMES } from "#/lib/themes.ts";

const TOKENS = [
  "brand",
  "link",
  "surface-1",
  "surface-2",
  "surface-3",
  "surface-4",
  "text-1",
  "text-2",
  "text-3",
  "ui-1",
  "ui-2",
  "ui-3",
  "ui-4",
  "ui-contrast",
  "hole",
  "portal",
  "portal-alt",
];

const themeCss = (key: string) =>
  Deno.readTextFileSync(
    new URL(`../styles/themes/${key}.css`, import.meta.url),
  );

Deno.test("every theme in the registry has a stylesheet", () => {
  for (const { key } of THEMES) {
    assert(themeCss(key).length > 0, key);
  }
});

Deno.test("every non-default theme sets all colour tokens", () => {
  for (const { key } of THEMES) {
    if (key === "skub") continue; // its tokens are the :root defaults
    const css = themeCss(key);
    for (const token of TOKENS) {
      assert(
        css.includes(`--color-${token}:`),
        `${key} lacks --color-${token}`,
      );
    }
  }
});

Deno.test("a theme's swatch matches its stylesheet", () => {
  for (const { key, surface, brand } of THEMES) {
    if (key === "skub") continue;
    const css = themeCss(key);
    assert(css.includes(surface), `${key} surface ${surface}`);
    assert(css.includes(brand), `${key} brand ${brand}`);
  }
});

Deno.test("a retired theme key resolves to skub", () => {
  assertEquals(resolveTheme("dracula"), "skub");
  assertEquals(resolveTheme(undefined), "skub");
  assertEquals(resolveTheme("acid"), "acid");
});
