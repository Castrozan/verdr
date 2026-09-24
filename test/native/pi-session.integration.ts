import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { openPiSession } from "../../src/native/pi/session.js";

test("Pi shutdown handler errors cannot become successful cleanup", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "verdr-pi-shutdown-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const profile = join(root, "profile");
  const workspace = join(root, "workspace");
  await mkdir(profile);
  await mkdir(workspace);
  const extension = join(root, "shutdown.ts");
  await writeFile(
    extension,
    'export default function(pi) { pi.on("session_shutdown", () => { throw new Error("shutdown failed"); }); }\n',
  );
  const variables = ["PI_AGENT_DIR", "PI_CODING_AGENT_DIR"];
  const previous = variables.map((name) => process.env[name]);
  for (const name of variables) process.env[name] = profile;
  context.after(() => {
    for (const [index, name] of variables.entries()) {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    }
  });
  const runtime =
    process.env.VERDR_PI_RUNTIME_MODULES ?? resolve("node_modules");
  const sdk = await import(
    pathToFileURL(
      join(runtime, "@earendil-works/pi-coding-agent/dist/index.js"),
    ).href
  );
  const loaded = await openPiSession(sdk, extension, profile, workspace);
  await assert.rejects(loaded.close(), /Pi native extension reported an error/);
});
