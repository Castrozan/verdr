import type * as Pi from "@earendil-works/pi-coding-agent";
import { mkdir, readFile, realpath, symlink } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { containedPath, containsPath, digest } from "../artifact.js";
import type { EvaluationCase } from "../suite.js";
import { openPiSession } from "./session.js";

export async function inspectPi(
  evaluation: Extract<EvaluationCase, { kind: "pi-discovery" | "pi-skill" }>,
  input: { root: string; profile: string; workspace: string },
) {
  const packageRoot = await containedPath(input.root, evaluation.package);
  const registration = await containedPath(input.root, evaluation.registration);
  if (registration !== packageRoot)
    throw new Error("Pi registration does not resolve the emitted package");
  const manifest = z
    .object({
      name: z
        .string()
        .regex(/^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/),
    })
    .parse(
      JSON.parse(await readFile(join(packageRoot, "plugin.json"), "utf8")),
    );
  const runtimeModules = await realpath(evaluation.runtimeModules);
  const sdkRoot = join(runtimeModules, "@earendil-works/pi-coding-agent");
  const loaderRoot = join(runtimeModules, "pi-agent-plugins");
  const sdkEntry = join(sdkRoot, "dist/index.js");
  const loaderEntry = join(loaderRoot, "extensions/index.ts");
  const versionSchema = z.object({ version: z.string().min(1) });
  const sdkVersion = versionSchema.parse(
    JSON.parse(await readFile(join(sdkRoot, "package.json"), "utf8")),
  ).version;
  const loaderVersion = versionSchema.parse(
    JSON.parse(await readFile(join(loaderRoot, "package.json"), "utf8")),
  ).version;
  const agentDirectory = join(input.profile, "pi");
  process.env.PI_AGENT_DIR = agentDirectory;
  process.env.PI_CODING_AGENT_DIR = agentDirectory;
  await mkdir(join(agentDirectory, "plugins"), { recursive: true });
  const sdk = (await import(pathToFileURL(sdkEntry).href)) as typeof Pi;
  const baseline = await openPiSession(
    sdk,
    loaderEntry,
    agentDirectory,
    input.workspace,
  );
  const baselineSkills = baseline.discovered.skills.map(
    ({ name, filePath }) => ({ name, filePath }),
  );
  baseline.session.dispose();
  await symlink(registration, join(agentDirectory, "plugins", manifest.name));
  const { session, discovered } = await openPiSession(
    sdk,
    loaderEntry,
    agentDirectory,
    input.workspace,
  );
  try {
    const skills = [];
    for (const skill of discovered.skills) {
      const filePath = await realpath(skill.filePath);
      if (!containsPath(packageRoot, filePath)) continue;
      skills.push({
        name: skill.name,
        description: skill.description,
        filePath,
      });
    }
    let expanded;
    if (evaluation.kind === "pi-skill") {
      const selected = skills.filter(
        (skill) => skill.name === evaluation.skill,
      );
      if (selected.length !== 1)
        throw new Error(
          "Expected exactly one native Pi skill from the emitted package",
        );
      await session.followUp(`/skill:${evaluation.skill}`);
      const queued = session.getFollowUpMessages();
      if (
        queued.length !== 1 ||
        !queued[0]!.startsWith(
          `<skill name="${evaluation.skill}" location="${selected[0]!.filePath}">`,
        )
      )
        throw new Error(
          "Pi skill expansion did not identify the expected native origin",
        );
      expanded = queued[0]!;
      session.clearQueue();
    }
    const evidence = {
      scope: expanded ? "native-skill-expansion" : "native-discovery",
      target: "pi",
      runtime: {
        modules: runtimeModules,
        sdk: {
          version: sdkVersion,
          entry: sdkEntry,
          sha256: digest(await readFile(sdkEntry)),
        },
        loader: {
          version: loaderVersion,
          entry: loaderEntry,
          sha256: digest(await readFile(loaderEntry)),
        },
      },
      registration,
      skills,
      diagnostics: discovered.diagnostics,
      host: { isolation: "fresh-user-profile", baselineSkills },
      execution: expanded ? "native-skill-expansion-queued" : "not-measured",
      modelConsumption: "not-measured",
      adherence: "not-measured",
      hooks: "not-measured",
    };
    return { output: expanded ?? JSON.stringify(evidence), metadata: evidence };
  } finally {
    session.clearQueue();
    session.dispose();
  }
}
