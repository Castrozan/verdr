import { mkdir, realpath } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { containedPath } from "../../artifact.js";
import { runProcess } from "../../process.js";
import type { EvaluationCase, Suite } from "../../suite/schema.js";

export async function inspectHermes(
  evaluation: Extract<
    EvaluationCase,
    { kind: "hermes-discovery" | "hermes-skill" }
  >,
  input: {
    root: string;
    profile: string;
    workspace: string;
    limits: Suite["limits"];
  },
) {
  const packageRoot = await containedPath(input.root, evaluation.package);
  const registration = await containedPath(input.root, evaluation.registration);
  if (registration !== packageRoot)
    throw new Error("Hermes registration does not resolve the emitted package");
  const home = join(input.profile, "hermes");
  const bundled = join(input.profile, "hermes-bundled");
  await mkdir(home);
  await mkdir(bundled);
  const result = await runProcess(
    evaluation.python,
    ["-I", "-B", fileURLToPath(new URL("./probe.py", import.meta.url))],
    {
      cwd: input.workspace,
      env: {
        ...process.env,
        HERMES_HOME: home,
        HERMES_BUNDLED_PLUGINS: bundled,
        HERMES_ENABLE_PROJECT_PLUGINS: "0",
      },
      input: JSON.stringify({
        packageRoot,
        registration,
        skill:
          evaluation.kind === "hermes-skill" ? evaluation.skill : undefined,
      }),
      ...input.limits,
      group: false,
    },
  );
  const response = z
    .object({
      output: z.string().min(1),
      metadata: z
        .object({
          target: z.literal("hermes"),
          registration: z.string(),
          skills: z.array(
            z.object({ name: z.string(), filePath: z.string() }).passthrough(),
          ),
          runtime: z.object({ version: z.string().min(1) }).passthrough(),
        })
        .passthrough(),
    })
    .parse(JSON.parse(result.stdout));
  if ((await realpath(response.metadata.registration)) !== packageRoot)
    throw new Error(
      "Native Hermes registration origin differs from emitted package",
    );
  for (const skill of response.metadata.skills)
    await containedPath(packageRoot, skill.filePath);
  return {
    output: response.output,
    metadata: {
      ...response.metadata,
      interpreter: evaluation.python,
      diagnostics: result.stderr,
    },
  };
}
