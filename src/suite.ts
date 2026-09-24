import { z } from "zod";

import { evaluationCase, relativeArtifactPath } from "./case.js";

export const suiteSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: z.string().min(1),
    artifact: z
      .object({
        root: z.string().min(1),
        packages: z.array(relativeArtifactPath).min(1),
        requiredFiles: z
          .array(
            z
              .object({
                path: relativeArtifactPath,
                sha256: z
                  .string()
                  .regex(/^[a-f0-9]{64}$/)
                  .optional(),
                executable: z.boolean().optional(),
              })
              .strict(),
          )
          .min(1),
        digest: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional(),
        provenance: z.record(z.string(), z.string()).default({}),
      })
      .strict(),
    cases: z.array(evaluationCase).min(1).max(100),
    limits: z
      .object({
        timeoutMs: z.number().int().min(100).max(600_000).default(60_000),
        maxOutputBytes: z
          .number()
          .int()
          .min(128)
          .max(16_777_216)
          .default(1_048_576),
        maxArtifactBytes: z
          .number()
          .int()
          .positive()
          .max(1_073_741_824)
          .default(67_108_864),
        maxArtifactEntries: z
          .number()
          .int()
          .positive()
          .max(100_000)
          .default(10_000),
      })
      .strict()
      .default({
        timeoutMs: 60_000,
        maxOutputBytes: 1_048_576,
        maxArtifactBytes: 67_108_864,
        maxArtifactEntries: 10_000,
      }),
    environment: z.array(z.string().regex(/^[A-Z][A-Z0-9_]*$/)).default([]),
  })
  .strict()
  .superRefine((suite, context) => {
    const identifiers = new Set<string>();
    for (const [index, evaluation] of suite.cases.entries()) {
      if (identifiers.has(evaluation.id))
        context.addIssue({
          code: "custom",
          message: "Duplicate case identifier",
          path: ["cases", index, "id"],
        });
      identifiers.add(evaluation.id);
      if (
        (evaluation.kind === "codex-discovery" ||
          evaluation.kind === "claude-discovery" ||
          evaluation.kind === "installed-identity") &&
        !suite.artifact.packages.includes(evaluation.package)
      )
        context.addIssue({
          code: "custom",
          message: "Native package must be a declared artifact package",
          path: ["cases", index, "package"],
        });
    }
    if (
      new Set(suite.artifact.packages).size !== suite.artifact.packages.length
    )
      context.addIssue({
        code: "custom",
        message: "Duplicate package root",
        path: ["artifact", "packages"],
      });
    for (const variable of suite.environment) {
      if (
        /^(HOME|PATH|CODEX_HOME|CLAUDE_CONFIG_DIR|XDG_.*|PROMPTFOO_.*|NODE_.*|VERDR_.*)$/.test(
          variable,
        )
      )
        context.addIssue({
          code: "custom",
          message: "Reserved isolation variable",
          path: ["environment"],
        });
    }
  });

export type Suite = z.infer<typeof suiteSchema>;
export type EvaluationCase = Suite["cases"][number];
