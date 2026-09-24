import { isAbsolute } from "node:path";
import { z } from "zod";

export const relativeArtifactPath = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !value.includes("\\") &&
      !value.split("/").includes("..") &&
      !value.includes("\0"),
    "Expected a contained relative path",
  );
const assertion = z.discriminatedUnion("type", [
  z
    .object({
      type: z.enum(["equals", "contains", "not-contains", "regex"]),
      value: z.string(),
    })
    .strict(),
  z.object({ type: z.literal("is-json") }).strict(),
]);
const caseFields = {
  id: z.string().min(1).max(128),
  assert: z.array(assertion).min(1),
};
const nativeFields = {
  ...caseFields,
  package: relativeArtifactPath,
  marketplace: relativeArtifactPath,
  plugin: z.string().min(1),
};
export const evaluationCase = z.discriminatedUnion("kind", [
  z
    .object({
      ...caseFields,
      kind: z.literal("file"),
      path: relativeArtifactPath,
    })
    .strict(),
  z
    .object({
      ...caseFields,
      kind: z.literal("command"),
      command: z.string().min(1),
      args: z.array(z.string()).default([]),
    })
    .strict(),
  z
    .object({
      ...caseFields,
      kind: z.literal("injected"),
      instructionFiles: z.array(relativeArtifactPath).min(1),
      prompt: z.string().min(1),
      provider: z
        .object({
          id: z.string().min(1),
          config: z.record(z.string(), z.unknown()).default({}),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...caseFields,
      kind: z.literal("installed-identity"),
      package: relativeArtifactPath,
      installedRoot: z
        .string()
        .min(1)
        .refine(isAbsolute, "Expected an absolute installed package root"),
      target: z.enum(["claude", "codex", "opencode", "pi", "hermes"]),
    })
    .strict(),
  z
    .object({
      ...nativeFields,
      kind: z.literal("codex-discovery"),
      executable: z.string().default("codex"),
    })
    .strict(),
  z
    .object({
      ...nativeFields,
      kind: z.literal("claude-discovery"),
      executable: z.string().default("claude"),
    })
    .strict(),
]);
