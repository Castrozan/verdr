import { randomUUID } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { z } from "zod";
import { containedPath, containsPath, digest } from "../artifact.js";
import { runProcess } from "../process.js";
import type { EvaluationCase, Suite } from "../suite/schema.js";

const discoveredSkills = z.array(
  z.object({
    name: z.string(),
    description: z.string(),
    location: z.string(),
    content: z.string(),
  }),
);
const invocationResult = z.object({
  tool: z.literal("skill"),
  input: z.object({ name: z.string() }),
  result: z
    .object({
      output: z.string().min(1),
      metadata: z.object({
        name: z.string(),
        dir: z.string(),
        truncated: z.boolean(),
      }),
    })
    .passthrough(),
});

export async function inspectOpenCode(
  evaluation: Extract<
    EvaluationCase,
    { kind: "opencode-discovery" | "opencode-skill" }
  >,
  input: { root: string; workspace: string; limits: Suite["limits"] },
) {
  const packageRoot = await containedPath(input.root, evaluation.package);
  const configuration = await containedPath(
    input.root,
    evaluation.configuration,
  );
  const environment = {
    ...process.env,
    OPENCODE_DISABLE_AUTOUPDATE: "1",
    OPENCODE_DISABLE_MODELS_FETCH: "1",
  };
  const execute = (args: string[], configured = true) =>
    runProcess(evaluation.executable, args, {
      cwd: input.workspace,
      env: configured
        ? { ...environment, OPENCODE_CONFIG: configuration }
        : environment,
      ...input.limits,
      group: false,
      stdoutPath: join(input.workspace, `opencode-${randomUUID()}.json`),
    });
  const version = (await execute(["--version"], false)).stdout.trim();
  const baseline = discoveredSkills.parse(
    JSON.parse((await execute(["debug", "skill"], false)).stdout),
  );
  const discovered = discoveredSkills.parse(
    JSON.parse((await execute(["debug", "skill"])).stdout),
  );
  const skills = [];
  for (const skill of discovered) {
    if (!isAbsolute(skill.location)) continue;
    const location = await realpath(skill.location);
    if (!containsPath(packageRoot, location)) continue;
    await containedPath(packageRoot, location);
    skills.push({ ...skill, location });
  }
  let invocation;
  if (evaluation.kind === "opencode-skill") {
    const selected = skills.filter((skill) => skill.name === evaluation.skill);
    if (selected.length !== 1)
      throw new Error(
        "Expected exactly one native skill from the emitted package",
      );
    invocation = invocationResult.parse(
      JSON.parse(
        (
          await execute([
            "debug",
            "agent",
            evaluation.agent,
            "--tool",
            "skill",
            "--params",
            JSON.stringify({ name: evaluation.skill }),
          ])
        ).stdout,
      ),
    );
    if (
      invocation.input.name !== evaluation.skill ||
      invocation.result.metadata.name !== evaluation.skill ||
      (await realpath(invocation.result.metadata.dir)) !==
        dirname(selected[0]!.location)
    )
      throw new Error("Native skill invocation resolved an unexpected origin");
    if (invocation.result.metadata.truncated)
      throw new Error("Native skill invocation returned truncated evidence");
  }
  const scope = invocation ? "native-skill-invocation" : "native-discovery";
  const evidence = {
    scope,
    target: "opencode",
    version,
    configuration: {
      path: configuration,
      sha256: digest(await readFile(configuration)),
    },
    skills: invocation
      ? skills.map(({ name, description, location }) => ({
          name,
          description,
          location,
        }))
      : skills,
    invocation,
    host: {
      isolation: "fresh-user-profile-with-inherited-system-policy",
      baselineSkills: baseline.map(({ name, location }) => ({
        name,
        location,
      })),
    },
    execution: invocation ? "native-debug-tool" : "not-measured",
    adherence: "not-measured",
    hooks: "debug-tool-bypasses-agent-loop-hooks",
  };
  return {
    output: invocation ? invocation.result.output : JSON.stringify(evidence),
    metadata: evidence,
  };
}
