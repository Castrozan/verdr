import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("the committed dependency lock installs entirely from public npm", async () => {
  const lock = JSON.parse(
    await readFile(new URL("../package-lock.json", import.meta.url), "utf8"),
  );
  for (const [name, dependency] of Object.entries(lock.packages) as [
    string,
    { resolved?: string },
  ][]) {
    if (dependency.resolved)
      assert.ok(
        dependency.resolved.startsWith("https://registry.npmjs.org/"),
        `Nonpublic dependency origin for ${name}`,
      );
  }
});
