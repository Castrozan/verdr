import { realpath } from "node:fs/promises";
import { containsPath } from "../../artifact.js";
import type { EvaluationCase } from "../../suite/schema.js";
import { loadPiPackage } from "./package.js";

export async function inspectPi(
  evaluation: Extract<EvaluationCase, { kind: "pi-discovery" | "pi-skill" }>,
  input: { root: string; profile: string; workspace: string },
) {
  const {
    session,
    discovered,
    packageRoot,
    registration,
    runtime,
    baselineSkills,
    close,
  } = await loadPiPackage(evaluation, input);
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
      runtime,
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
    await close();
  }
}
