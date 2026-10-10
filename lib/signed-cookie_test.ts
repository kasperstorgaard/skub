import { assertEquals } from "@std/assert";

import { signValue, verifyValue } from "./signed-cookie.ts";

const SECRET = "test-secret";
const PAYLOAD = JSON.stringify({ id: "a1", theme: "dracula", name: "Ada ✨" });

Deno.test("verifyValue() returns the payload a signed value carries", async () => {
  const value = await signValue(PAYLOAD, SECRET);

  const payload = await verifyValue(value, SECRET);
  assertEquals(payload, PAYLOAD);
});

Deno.test("verifyValue() rejects a payload edited to raise the skill level", async () => {
  const [, tag] = (await signValue(PAYLOAD, SECRET)).split(".");
  const forged = new TextEncoder().encode(
    JSON.stringify({ id: "a1", skillLevel: "expert" }),
  ).toBase64({ alphabet: "base64url", omitPadding: true });

  const payload = await verifyValue(`${forged}.${tag}`, SECRET);
  assertEquals(payload, null);
});

Deno.test("verifyValue() rejects a value with one flipped tag character", async () => {
  const [body, tag] = (await signValue(PAYLOAD, SECRET)).split(".");
  const flipped = tag[5] === "A" ? "B" : "A";
  const tampered = `${body}.${tag.slice(0, 5)}${flipped}${tag.slice(6)}`;

  const payload = await verifyValue(tampered, SECRET);
  assertEquals(payload, null);
});

Deno.test("verifyValue() rejects a value signed with another secret", async () => {
  const value = await signValue(PAYLOAD, "another-secret");

  const payload = await verifyValue(value, SECRET);
  assertEquals(payload, null);
});

Deno.test("verifyValue() rejects malformed values instead of throwing", async () => {
  const results = await Promise.all(
    ["", "no-dot", "a.b.c", "!!!.???", "."].map((value) =>
      verifyValue(value, SECRET)
    ),
  );

  assertEquals(results, [null, null, null, null, null]);
});
