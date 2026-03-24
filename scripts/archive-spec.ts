import { slug as slugify } from "@annervisser/slug";

// Accept branch name as CLI arg (used by CI), fall back to current branch (local use)
let branch = Deno.args[0];

if (!branch) {
  const result = await new Deno.Command("git", {
    args: ["branch", "--show-current"],
    stdout: "piped",
  }).output();
  branch = new TextDecoder().decode(result.stdout).trim();
}

const filename = slugify(branch.replace("/", "-"));

await Deno.mkdir("specs", { recursive: true });
await Deno.copyFile("spec.md", `specs/${filename}.md`);
await Deno.remove("spec.md");

console.log(`Archived spec.md → specs/${filename}.md`);
