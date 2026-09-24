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
      ...caseFields,
      kind: z.literal("opencode-discovery"),
      package: relativeArtifactPath,
      configuration: relativeArtifactPath,
      executable: z.string().default("opencode"),
    })
    .strict(),
  z
    .object({
      ...caseFields,
      kind: z.literal("opencode-skill"),
      package: relativeArtifactPath,
      configuration: relativeArtifactPath,
      executable: z.string().default("opencode"),
      skill: z.string().min(1),
      agent: z.string().default("build"),
    })
    .strict(),
  z
    .object({
      ...caseFields,
      kind: z.literal("pi-discovery"),
      package: relativeArtifactPath,
      registration: relativeArtifactPath,
      runtimeModules: z
        .string()
        .refine(isAbsolute, "Expected an absolute runtime modules directory"),
    })
    .strict(),
  z
    .object({
      ...caseFields,
      kind: z.literal("pi-skill"),
      package: relativeArtifactPath,
      registration: relativeArtifactPath,
      runtimeModules: z
        .string()
        .refine(isAbsolute, "Expected an absolute runtime modules directory"),
      skill: z.string().min(1),
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
      kind: z.literal("codex-mcp"),
      executable: z.string().default("codex"),
      server: z.string().min(1),
      tool: z.string().min(1),
      arguments: z.record(z.string(), z.unknown()).default({}),
    })
    .strict(),
  z
    .object({
      ...nativeFields,
      kind: z.literal("claude-discovery"),
      executable: z.string().default("claude"),
    })
    .strict(),
  z
    .object({
      ...nativeFields,
      kind: z.literal("claude-mcp"),
      executable: z.string().default("claude"),
      server: z.string().min(1),
      tool: z.string().regex(/^[a-zA-Z0-9_-]+$/),
      arguments: z.record(z.string(), z.unknown()).default({}),
    })
    .strict(),
]);
