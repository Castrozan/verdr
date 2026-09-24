import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  symlink,
  rm,
  chmod,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { inspectArtifact, snapshotArtifact } from "../src/artifact.js";
import { suiteSchema } from "../src/suite.js";

async function fixture(context: {
  after: (callback: () => Promise<void>) => void;
}) {
  const root = await mkdtemp(join(tmpdir(), "verdr-artifact-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, ".agents/plugins/example"), { recursive: true });
  await symlink(".agents/plugins/example", join(root, "plugin"));
  await writeFile(
    join(root, "plugin/plugin.json"),
    JSON.stringify({
      $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
      name: "example",
      extensions: { "com.example.client": { opaque: true } },
    }),
  );
  await writeFile(join(root, "plugin/reference.txt"), "emitted only");
  const suite = suiteSchema.parse({
    schemaVersion: 1,
    name: "artifact",
    artifact: {
      root,
      packages: ["plugin"],
      requiredFiles: [{ path: "plugin/reference.txt" }],
    },
    cases: [
      {
        id: "resource",
        kind: "file",
        path: "plugin/reference.txt",
        assert: [{ type: "contains", value: "emitted" }],
      },
    ],
  });
  return { root, suite };
}

test("reads the emitted package through its canonical symlink and retains opaque extensions", async (context) => {
  const { suite } = await fixture(context);
  const snapshot = await inspectArtifact(suite);
  assert.ok(
    snapshot.entries.some(
      (entry) => entry.path === "plugin" && entry.kind === "symlink",
    ),
  );
  assert.match(snapshot.digest, /^[a-f0-9]{64}$/);
});

test("rejects corrupt emitted metadata regardless of a valid source copy", async (context) => {
  const { root, suite } = await fixture(context);
  await writeFile(
    join(root, "valid-source.json"),
    JSON.stringify({
      $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
      name: "example",
    }),
  );
  await writeFile(
    join(root, "plugin/plugin.json"),
    JSON.stringify({ name: "example" }),
  );
  await assert.rejects(inspectArtifact(suite), /Invalid emitted manifest/);
});

test("rejects missing assets from the consumer inventory", async (context) => {
  const { root, suite } = await fixture(context);
  await rm(join(root, "plugin/reference.txt"));
  await assert.rejects(inspectArtifact(suite), /ENOENT/);
});

test("rejects escaping symlinks before reading external content", async (context) => {
  const { root, suite } = await fixture(context);
  await symlink(tmpdir(), join(root, "outside"));
  await assert.rejects(inspectArtifact(suite), /escapes artifact/);
});

test("identity changes with executable permissions and opaque resource bytes", async (context) => {
  const { root, suite } = await fixture(context);
  const before = await inspectArtifact(suite);
  await chmod(join(root, "plugin/reference.txt"), 0o755);
  const executable = await inspectArtifact(suite);
  assert.notEqual(before.digest, executable.digest);
  await writeFile(join(root, "plugin/reference.txt"), "changed");
  assert.notEqual(executable.digest, (await inspectArtifact(suite)).digest);
});

test("enforces declared artifact identity and resource bounds", async (context) => {
  const { suite } = await fixture(context);
  await assert.rejects(
    inspectArtifact({
      ...suite,
      artifact: { ...suite.artifact, digest: "0".repeat(64) },
    }),
    /identity/,
  );
  await assert.rejects(
    snapshotArtifact(suite.artifact.root, {
      ...suite.limits,
      maxArtifactBytes: 1,
    }),
    /byte limit/,
  );
  await assert.rejects(
    snapshotArtifact(suite.artifact.root, {
      ...suite.limits,
      maxArtifactEntries: 1,
    }),
    /entry limit/,
  );
});

test("rejects duplicate cases and attempts to inherit global profiles", async (context) => {
  const { suite } = await fixture(context);
  assert.equal(
    suiteSchema.safeParse({ ...suite, cases: [suite.cases[0], suite.cases[0]] })
      .success,
    false,
  );
  assert.equal(
    suiteSchema.safeParse({ ...suite, environment: ["CODEX_HOME"] }).success,
    false,
  );
});
