import { parseArgs } from "@std/cli/parse-args";
import { chromium, devices } from "playwright";

const args = parseArgs(Deno.args, {
  boolean: ["mobile", "desktop"],
  string: ["pages"],
  default: { mobile: true, desktop: false },
});

const defaultPages = [
  "/",
  "/puzzles",
  "/puzzles/eik",
  "/puzzles/eik/solutions",
  "/profile",
];

const pageAliases: Record<string, string> = {
  home: "/",
  puzzles: "/puzzles",
  profile: "/profile",
};

const resolvePageAlias = (page: string) => pageAliases[page] ?? page;

const pages = args.pages
  ? args.pages.split(",").map(resolvePageAlias)
  : defaultPages;
const viewports = args.desktop
  ? [{ name: "desktop", device: devices["Desktop Chrome"] }]
  : [{ name: "mobile", device: devices["iPhone 14"] }];

const base = "http://localhost:5173";
const browser = await chromium.launch();

for (const { name: viewport, device } of viewports) {
  const ctx = await browser.newContext({ ...device });

  await ctx.addCookies([{
    name: "tracking_id",
    value: "declined",
    domain: "localhost",
    path: "/",
  }]);

  const page = await ctx.newPage();

  for (const path of pages) {
    const url = new URL(path, base);
    await page.goto(url.href, { waitUntil: "networkidle" });

    const slug = url.pathname.slice(1).replace(/\//g, "-") || "home";
    const file = `screenshots/${slug}-${viewport}.png`;

    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
  }

  await ctx.close();
}

await browser.close();
