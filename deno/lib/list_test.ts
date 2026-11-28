import { assertEquals, assertThrows } from "@std/assert";

import { sortList } from "./list.ts";

Deno.test("sortList - sorts strings ascending", () => {
  const items = [
    { name: "cherry" },
    { name: "apple" },
    { name: "banana" },
  ];

  const result = sortList(items, {
    sortBy: "name",
    sortOrder: "ascending",
  });

  assertEquals(result, [
    { name: "apple" },
    { name: "banana" },
    { name: "cherry" },
  ]);
});

Deno.test("sortList - sorts strings descending", () => {
  const items = [
    { name: "apple" },
    { name: "cherry" },
    { name: "banana" },
  ];

  const result = sortList(items, {
    sortBy: "name",
    sortOrder: "descending",
  });

  assertEquals(result, [
    { name: "cherry" },
    { name: "banana" },
    { name: "apple" },
  ]);
});

Deno.test("sortList - sorts numbers ascending", () => {
  const items = [
    { score: 30 },
    { score: 10 },
    { score: 20 },
  ];

  const result = sortList(items, {
    sortBy: "score",
    sortOrder: "ascending",
  });

  assertEquals(result, [
    {
      score: 10,
    },
    { score: 20 },
    { score: 30 },
  ]);
});

Deno.test("sortList - sorts numbers descending", () => {
  const items = [
    { score: 10 },
    { score: 30 },
    { score: 20 },
  ];

  const result = sortList(items, {
    sortBy: "score",
    sortOrder: "descending",
  });

  assertEquals(result, [{ score: 30 }, { score: 20 }, { score: 10 }]);
});

Deno.test("sortList - sorts dates ascending", () => {
  const items = [
    { createdAt: new Date(2024, 5, 15) },
    { createdAt: new Date(2024, 0, 1) },
    { createdAt: new Date(2024, 11, 31) },
  ];

  const result = sortList(items, {
    sortBy: "createdAt",
    sortOrder: "ascending",
  });

  assertEquals(result, [
    { createdAt: new Date(2024, 0, 1) },
    { createdAt: new Date(2024, 5, 15) },
    { createdAt: new Date(2024, 11, 31) },
  ]);
});

Deno.test("sortList - sorts dates descending", () => {
  const items = [
    { createdAt: new Date(2024, 0, 1) },
    { createdAt: new Date(2024, 11, 31) },
    { createdAt: new Date(2024, 5, 15) },
  ];

  const result = sortList(items, {
    sortBy: "createdAt",
    sortOrder: "descending",
  });

  assertEquals(result, [
    { createdAt: new Date(2024, 11, 31) },
    { createdAt: new Date(2024, 5, 15) },
    { createdAt: new Date(2024, 0, 1) },
  ]);
});

Deno.test("sortList - handles equal values", () => {
  const items = [
    { name: "alice", score: 100 },
    { name: "bob", score: 100 },
    { name: "charlie", score: 100 },
  ];

  const result = sortList(items, {
    sortBy: "score",
    sortOrder: "ascending",
  });

  assertEquals(result.length, 3);
  assertEquals(result.every((item) => item.score === 100), true);
});

Deno.test("sortList - handles empty array", () => {
  const items: { name: string }[] = [];

  const result = sortList(items, {
    sortBy: "name",
    sortOrder: "ascending",
  });

  assertEquals(result, []);
});

Deno.test("sortList - handles single item", () => {
  const items = [{ name: "only" }];

  const result = sortList(items, {
    sortBy: "name",
    sortOrder: "ascending",
  });

  assertEquals(result, [{ name: "only" }]);
});

Deno.test("sortList - throws for null", () => {
  const items = [
    { data: { nested: true } },
    { data: { nested: false } },
  ];

  assertThrows(
    () =>
      sortList(items, {
        sortBy: "data",
        sortOrder: "ascending",
      }),
    Error,
  );
});

Deno.test("sortList - throws for undefined", () => {
  const items = [
    { data: { nested: true } },
    { data: { nested: false } },
  ];

  assertThrows(
    () =>
      sortList(items, {
        sortBy: "data",
        sortOrder: "ascending",
      }),
    Error,
  );
});

Deno.test("sortList - throws for function", () => {
  const items = [
    { data: function () {} },
    { data: { nested: false } },
  ];

  assertThrows(
    () =>
      sortList(items, {
        sortBy: "data",
        sortOrder: "ascending",
      }),
    Error,
  );
});

Deno.test("sortList - throws for object", () => {
  const items = [
    { data: { nested: true } },
    { data: { nested: false } },
  ];

  assertThrows(
    () =>
      sortList(items, {
        sortBy: "data",
        sortOrder: "ascending",
      }),
    Error,
  );
});
