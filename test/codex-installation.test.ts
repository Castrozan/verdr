import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { installedPackages } from "../src/codex/installation.js";

test("Codex package discovery preserves opaque native manifests while rejecting a broken portable root", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "verdr-codex-cache-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const packageRoot = join(root, "marketplace/plugin/1.0.0");
  await mkdir(join(packageRoot, ".claude-plugin"), { recursive: true });
  await writeFile(join(packageRoot, ".claude-plugin/plugin.json"), "{broken");
  await writeFile(
    join(packageRoot, "plugin.json"),
    JSON.stringify({
      $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
      name: "portable-package",
    }),
  );
  assert.deepEqual(await installedPackages(root), [packageRoot]);
  await mkdir(join(packageRoot, "examples/nested"), { recursive: true });
  await writeFile(
    join(packageRoot, "examples/nested/plugin.json"),
    JSON.stringify({
      $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
      name: "documentation-example",
    }),
  );
  assert.deepEqual(await installedPackages(root), [packageRoot]);
  await rm(join(packageRoot, "examples"), { recursive: true });
  await writeFile(join(packageRoot, "plugin.json"), "{broken");
  assert.deepEqual(await installedPackages(root), []);
});
