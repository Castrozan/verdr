import { realpath } from "node:fs/promises";
import { containedPath, snapshotArtifact } from "./artifact.js";
import type { EvaluationCase, Suite } from "./suite.js";

export async function inspectInstallation(
  evaluation: Extract<EvaluationCase, { kind: "installed-identity" }>,
  input: { root: string; limits: Suite["limits"] },
) {
  const emittedRoot = await containedPath(input.root, evaluation.package);
  const installedRoot = await realpath(evaluation.installedRoot);
  const emitted = await snapshotArtifact(emittedRoot, input.limits);
  const installed = await snapshotArtifact(installedRoot, input.limits);
  if (emitted.digest !== installed.digest)
    throw new Error("Installed package differs from the emitted package");
  if (
    (await realpath(evaluation.installedRoot)) !== installedRoot ||
    (await snapshotArtifact(installedRoot, input.limits)).digest !==
      installed.digest
  )
    throw new Error("Installed package changed during inspection");
  return {
    output: JSON.stringify({
      scope: "installed-identity",
      target: evaluation.target,
      emitted: { root: emittedRoot, digest: emitted.digest },
      installed: {
        requestedRoot: evaluation.installedRoot,
        root: installedRoot,
        digest: installed.digest,
      },
      entries: installed.entries.length,
      bytes: installed.bytes,
      discovery: "not-measured",
      execution: "not-measured",
    }),
    metadata: {
      scope: "installed-identity",
      installationDigest: installed.digest,
    },
  };
}
